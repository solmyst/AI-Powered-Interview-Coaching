export interface SpeechAnalysisData {
  transcript: string;
  interimTranscript: string;
  fillerWordCount: number;
  fillerWords: { word: string; count: number }[];
  wordsPerMinute: number;
  speakingPace: 'slow' | 'good' | 'fast';
  totalWords: number;
  silenceDuration: number;  // current silence in seconds
  longestSilence: number;
  clarity: number;          // 0-100 composite
  isListening: boolean;
}

type SpeechCallback = (data: SpeechAnalysisData) => void;

const FILLER_PATTERNS = [
  'um', 'uh', 'uhh', 'umm', 'hmm', 'hm',
  'like', 'you know', 'basically', 'actually',
  'literally', 'so', 'right', 'okay so',
  'i mean', 'kind of', 'sort of', 'well'
];

export class SpeechAnalysisService {
  private recognition: SpeechRecognition | null = null;
  private callback: SpeechCallback | null = null;
  private isRunning = false;
  private useExternalSource = false;  // true = Whisper mode (no Web Speech API)

  // Accumulated data
  private fullTranscript = '';
  private interimTranscript = '';
  private fillerCounts: Map<string, number> = new Map();
  private totalWords = 0;
  private startTime = 0;
  private lastSpeechTime = 0;
  private longestSilence = 0;
  private silenceCheckInterval: ReturnType<typeof setInterval> | null = null;

  // WPM tracking
  private wordTimestamps: number[] = [];
  private readonly WPM_WINDOW_MS = 30000; // 30 second rolling window

  static isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  initialize(): void {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.error('[SpeechAnalysis] Web Speech API not supported');
      throw new Error('Web Speech API is not supported in this browser. Please use Chrome.');
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.handleResult(event);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[SpeechAnalysis] Error:', event.error);
      // Auto-restart on recoverable errors
      if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'network') {
        if (this.isRunning) {
          setTimeout(() => this.restartRecognition(), 500);
        }
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if we're still supposed to be running
      if (this.isRunning) {
        setTimeout(() => this.restartRecognition(), 200);
      }
    };

    console.log('[SpeechAnalysis] Initialized');
  }

  /**
   * Start in full mode — uses Web Speech API for recognition + analysis.
   */
  start(callback: SpeechCallback): void {
    if (!this.recognition) {
      console.error('[SpeechAnalysis] Not initialized');
      return;
    }

    this.callback = callback;
    this.isRunning = true;
    this.useExternalSource = false;
    this.fullTranscript = '';
    this.interimTranscript = '';
    this.fillerCounts = new Map();
    this.totalWords = 0;
    this.startTime = Date.now();
    this.lastSpeechTime = Date.now();
    this.longestSilence = 0;
    this.wordTimestamps = [];

    try {
      this.recognition.start();
    } catch {
      // Already started
    }

    // Track silence duration
    this.silenceCheckInterval = setInterval(() => {
      if (this.isRunning) {
        const currentSilence = (Date.now() - this.lastSpeechTime) / 1000;
        if (currentSilence > this.longestSilence) {
          this.longestSilence = currentSilence;
        }
        this.emitUpdate();
      }
    }, 1000);

    this.emitUpdate();
  }

  /**
   * Start in analysis-only mode — no Web Speech API.
   * Call processExternalTranscript() to feed text from Whisper.
   */
  startAnalysisOnly(callback: SpeechCallback): void {
    this.callback = callback;
    this.isRunning = true;
    this.useExternalSource = true;
    this.fullTranscript = '';
    this.interimTranscript = '';
    this.fillerCounts = new Map();
    this.totalWords = 0;
    this.startTime = Date.now();
    this.lastSpeechTime = Date.now();
    this.longestSilence = 0;
    this.wordTimestamps = [];

    // Track silence duration
    this.silenceCheckInterval = setInterval(() => {
      if (this.isRunning) {
        const currentSilence = (Date.now() - this.lastSpeechTime) / 1000;
        if (currentSilence > this.longestSilence) {
          this.longestSilence = currentSilence;
        }
        this.emitUpdate();
      }
    }, 1000);

    this.emitUpdate();
    console.log('[SpeechAnalysis] Started in analysis-only mode (Whisper)');
  }

  /**
   * Process a transcript segment from an external source (Whisper).
   * Runs filler detection, WPM tracking, etc.
   */
  processExternalTranscript(newText: string): void {
    if (!this.isRunning || !newText?.trim()) return;

    const trimmed = newText.trim();
    this.fullTranscript += (this.fullTranscript ? ' ' : '') + trimmed;
    this.lastSpeechTime = Date.now();

    // Count new words
    const newWords = trimmed.split(/\s+/).filter(w => w.length > 0);
    this.totalWords += newWords.length;

    // Track word timestamps for WPM
    const now = Date.now();
    for (let i = 0; i < newWords.length; i++) {
      this.wordTimestamps.push(now);
    }

    // Detect filler words
    this.detectFillerWords(trimmed.toLowerCase());
    this.emitUpdate();
  }

  stop(): SpeechAnalysisData {
    this.isRunning = false;

    if (this.recognition && !this.useExternalSource) {
      try {
        this.recognition.stop();
      } catch {
        // Already stopped
      }
    }

    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }

    return this.getCurrentData();
  }

  destroy(): void {
    this.stop();
    this.recognition = null;
  }

  getTranscript(): string {
    return this.fullTranscript;
  }

  private restartRecognition(): void {
    if (!this.isRunning || !this.recognition) return;
    try {
      this.recognition.start();
    } catch {
      // May already be running
    }
  }

  private handleResult(event: SpeechRecognitionEvent): void {
    let interim = '';
    let finalSegment = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;

      if (result.isFinal) {
        finalSegment += text;
      } else {
        interim += text;
      }
    }

    if (finalSegment) {
      this.fullTranscript += (this.fullTranscript ? ' ' : '') + finalSegment.trim();
      this.lastSpeechTime = Date.now();

      // Count new words
      const newWords = finalSegment.trim().split(/\s+/).filter(w => w.length > 0);
      this.totalWords += newWords.length;

      // Track word timestamps for WPM
      const now = Date.now();
      for (let i = 0; i < newWords.length; i++) {
        this.wordTimestamps.push(now);
      }

      // Detect filler words in the new segment
      this.detectFillerWords(finalSegment.toLowerCase());
    }

    this.interimTranscript = interim;
    this.emitUpdate();
  }

  private detectFillerWords(text: string): void {
    for (const filler of FILLER_PATTERNS) {
      // Use word boundary matching for single words, partial for phrases
      const regex = filler.includes(' ')
        ? new RegExp(filler, 'gi')
        : new RegExp(`\\b${filler}\\b`, 'gi');

      const matches = text.match(regex);
      if (matches) {
        const current = this.fillerCounts.get(filler) || 0;
        this.fillerCounts.set(filler, current + matches.length);
      }
    }
  }

  private calculateWPM(): number {
    const now = Date.now();
    const windowStart = now - this.WPM_WINDOW_MS;

    // Remove old timestamps
    this.wordTimestamps = this.wordTimestamps.filter(t => t > windowStart);

    if (this.wordTimestamps.length < 2) {
      // Not enough data, calculate from total
      const elapsedMinutes = (now - this.startTime) / 60000;
      if (elapsedMinutes < 0.1) return 0;
      return Math.round(this.totalWords / elapsedMinutes);
    }

    // Calculate from rolling window
    const windowDurationMin = (now - this.wordTimestamps[0]) / 60000;
    if (windowDurationMin < 0.05) return 0;
    return Math.round(this.wordTimestamps.length / windowDurationMin);
  }

  private getSpeakingPace(wpm: number): 'slow' | 'good' | 'fast' {
    if (wpm === 0) return 'slow';
    if (wpm < 100) return 'slow';
    if (wpm > 160) return 'fast';
    return 'good';
  }

  private calculateClarity(): number {
    if (this.totalWords === 0) return 0; // Default to 0 until speech detected

    const totalFillers = this.getTotalFillerCount();
    const fillerRatio = totalFillers / Math.max(1, this.totalWords);

    // Lower filler ratio = higher clarity
    // 0% fillers = 100, 10% fillers = 50, 20%+ fillers = 0
    const fillerPenalty = Math.min(100, fillerRatio * 500);

    // WPM penalty: too fast or too slow reduces clarity
    const wpm = this.calculateWPM();
    let pacePenalty = 0;
    if (wpm > 0) {
      if (wpm < 90 || wpm > 180) pacePenalty = 20;
      else if (wpm < 100 || wpm > 160) pacePenalty = 10;
    }

    return Math.round(Math.max(0, Math.min(100, 100 - fillerPenalty - pacePenalty)));
  }

  private getTotalFillerCount(): number {
    let total = 0;
    this.fillerCounts.forEach(count => { total += count; });
    return total;
  }

  private getFillerWordBreakdown(): { word: string; count: number }[] {
    const breakdown: { word: string; count: number }[] = [];
    this.fillerCounts.forEach((count, word) => {
      if (count > 0) {
        breakdown.push({ word, count });
      }
    });
    return breakdown.sort((a, b) => b.count - a.count);
  }

  private getCurrentData(): SpeechAnalysisData {
    const wpm = this.calculateWPM();
    const currentSilence = (Date.now() - this.lastSpeechTime) / 1000;

    return {
      transcript: this.fullTranscript,
      interimTranscript: this.interimTranscript,
      fillerWordCount: this.getTotalFillerCount(),
      fillerWords: this.getFillerWordBreakdown(),
      wordsPerMinute: wpm,
      speakingPace: this.getSpeakingPace(wpm),
      totalWords: this.totalWords,
      silenceDuration: Math.round(currentSilence),
      longestSilence: Math.round(this.longestSilence),
      clarity: this.calculateClarity(),
      isListening: this.isRunning
    };
  }

  private emitUpdate(): void {
    this.callback?.(this.getCurrentData());
  }
}

// TypeScript declarations for Web Speech API
declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
    onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
    onend: ((this: SpeechRecognition, ev: Event) => void) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
    abort(): void;
    stop(): void;
    start(): void;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    readonly isFinal: boolean;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  let SpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };

  let webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };

  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
