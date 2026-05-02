/**
 * WhisperService — Main-thread service for Whisper speech recognition.
 *
 * Captures microphone audio via AudioContext, resamples to 16kHz mono,
 * buffers chunks, and sends them to a Web Worker running the Whisper model.
 *
 * Provides the same SpeechAnalysisData interface as the old Web Speech API
 * service for drop-in compatibility.
 */

export type WhisperStatus = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

export interface WhisperProgress {
  status: WhisperStatus;
  progress: number; // 0-100
  message: string;
}

export interface WhisperTranscriptEvent {
  fullTranscript: string;
  newSegment: string;
}

type ProgressCallback = (progress: WhisperProgress) => void;
type TranscriptCallback = (event: WhisperTranscriptEvent) => void;

export class WhisperService {
  private worker: Worker | null = null;
  private status: WhisperStatus = 'idle';
  private progressCallback: ProgressCallback | null = null;
  private transcriptCallback: TranscriptCallback | null = null;

  // Audio capture
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;

  // Audio buffer (accumulate ~5s chunks before transcribing)
  private audioBuffer: Float32Array[] = [];
  private bufferSampleCount = 0;
  private readonly CHUNK_DURATION_S = 5;
  private readonly TARGET_SAMPLE_RATE = 16000;
  private isCapturing = false;
  private isMuted = false;

  // Transcript state
  private fullTranscript = '';
  private isProcessing = false;
  private pendingAudio: Float32Array | null = null;

  /**
   * Load the Whisper model in a Web Worker.
   * Call this early (e.g. when user clicks "Start Interview") to begin download.
   */
  async loadModel(onProgress?: ProgressCallback): Promise<void> {
    this.progressCallback = onProgress || null;

    return new Promise<void>((resolve, reject) => {
      // Create worker using Vite's worker syntax
      this.worker = new Worker(
        new URL('../workers/whisperWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent) => {
        const { type, progress, status: statusMsg, text, error } = event.data;

        if (type === 'loading') {
          this.status = 'loading';
          this.progressCallback?.({
            status: 'loading',
            progress: progress || 0,
            message: statusMsg || 'Loading...',
          });
        }

        if (type === 'ready') {
          this.status = 'ready';
          this.progressCallback?.({
            status: 'ready',
            progress: 100,
            message: 'Whisper ready!',
          });
          resolve();
        }

        if (type === 'result') {
          this.handleTranscriptionResult(text);
        }

        if (type === 'error') {
          console.error('[WhisperService] Worker error:', error);
          if (this.status === 'loading') {
            this.status = 'error';
            this.progressCallback?.({
              status: 'error',
              progress: 0,
              message: error,
            });
            reject(new Error(error));
          }
        }
      };

      this.worker.onerror = (err) => {
        console.error('[WhisperService] Worker crashed:', err);
        this.status = 'error';
        reject(err);
      };

      // Tell the worker to load the model
      this.worker.postMessage({ type: 'load' });
    });
  }

  /**
   * Start capturing audio from the microphone and transcribing.
   */
  startCapture(stream: MediaStream, onTranscript: TranscriptCallback): void {
    if (this.status !== 'ready') {
      console.warn('[WhisperService] Model not ready, cannot start capture');
      return;
    }

    this.transcriptCallback = onTranscript;
    this.mediaStream = stream;
    this.fullTranscript = '';
    this.audioBuffer = [];
    this.bufferSampleCount = 0;
    this.isCapturing = true;
    this.isMuted = false;

    // Create audio context for capturing raw PCM
    this.audioContext = new AudioContext({ sampleRate: this.TARGET_SAMPLE_RATE });
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // Use ScriptProcessor to capture raw audio data (4096 buffer, mono)
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.isCapturing || this.isMuted) return;

      const inputData = event.inputBuffer.getChannelData(0);
      const chunk = new Float32Array(inputData);
      this.audioBuffer.push(chunk);
      this.bufferSampleCount += chunk.length;

      // When we have enough audio (~5 seconds), send to worker
      const targetSamples = this.CHUNK_DURATION_S * this.TARGET_SAMPLE_RATE;
      if (this.bufferSampleCount >= targetSamples) {
        this.flushBuffer();
      }
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);

    console.log('[WhisperService] Audio capture started');
  }

  /**
   * Mute/unmute — stops feeding audio to Whisper without stopping capture.
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      // Clear any pending audio buffer
      this.audioBuffer = [];
      this.bufferSampleCount = 0;
    }
  }

  /**
   * Stop capturing and flush any remaining audio.
   */
  async stopCapture(): Promise<string> {
    this.isCapturing = false;

    // Flush any remaining buffered audio
    if (this.bufferSampleCount > 0) {
      this.flushBuffer();
    }

    // Wait for any in-progress transcription
    await this.waitForProcessing();

    // Cleanup audio nodes
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { await this.audioContext.close(); } catch { /* ignore */ }
      this.audioContext = null;
    }

    console.log('[WhisperService] Audio capture stopped');
    return this.fullTranscript;
  }

  /**
   * Destroy the service and terminate the worker.
   */
  destroy(): void {
    this.isCapturing = false;

    if (this.scriptProcessor) {
      try { this.scriptProcessor.disconnect(); } catch { /* ignore */ }
      this.scriptProcessor = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* ignore */ }
      this.sourceNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch { /* ignore */ }
      this.audioContext = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.status = 'idle';
    this.audioBuffer = [];
    this.bufferSampleCount = 0;
    this.fullTranscript = '';
  }

  getStatus(): WhisperStatus {
    return this.status;
  }

  getTranscript(): string {
    return this.fullTranscript;
  }

  /**
   * Concatenate buffered chunks and send to worker.
   */
  private flushBuffer(): void {
    if (this.audioBuffer.length === 0) return;

    // Merge all chunks into a single Float32Array
    const merged = new Float32Array(this.bufferSampleCount);
    let offset = 0;
    for (const chunk of this.audioBuffer) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    this.audioBuffer = [];
    this.bufferSampleCount = 0;

    // Check if audio has meaningful content (not silence)
    const rms = Math.sqrt(merged.reduce((sum, v) => sum + v * v, 0) / merged.length);
    if (rms < 0.005) {
      // Too quiet — likely silence, skip transcription
      return;
    }

    // Send to worker (or queue if already processing)
    if (this.isProcessing) {
      // Replace any pending audio — latest chunk wins
      this.pendingAudio = merged;
    } else {
      this.sendToWorker(merged);
    }
  }

  private sendToWorker(audio: Float32Array): void {
    if (!this.worker) return;
    this.isProcessing = true;
    this.status = 'transcribing';
    this.worker.postMessage({ type: 'transcribe', audio });
  }

  private handleTranscriptionResult(text: string): void {
    this.isProcessing = false;
    this.status = 'ready';

    if (text && text.trim()) {
      // Filter out Whisper hallucination patterns
      const filtered = text
        .replace(/\[.*?\]/g, '')          // remove [BLANK_AUDIO], [Music], etc.
        .replace(/\(.*?\)/g, '')          // remove (inaudible), etc.
        .replace(/♪/g, '')               // remove music notes
        .replace(/^\s*\.+\s*$/, '')       // remove lone dots
        .trim();

      if (filtered && filtered.length > 1) {
        const segment = filtered;
        this.fullTranscript += (this.fullTranscript ? ' ' : '') + segment;

        this.transcriptCallback?.({
          fullTranscript: this.fullTranscript,
          newSegment: segment,
        });
      }
    }

    // Process pending audio if any
    if (this.pendingAudio) {
      const pending = this.pendingAudio;
      this.pendingAudio = null;
      this.sendToWorker(pending);
    }
  }

  private waitForProcessing(): Promise<void> {
    if (!this.isProcessing) return Promise.resolve();

    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!this.isProcessing) {
          clearInterval(check);
          resolve();
        }
      }, 200);

      // Timeout after 10s
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 10000);
    });
  }
}
