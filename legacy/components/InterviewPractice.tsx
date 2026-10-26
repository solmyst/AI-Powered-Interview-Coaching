import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Mic, Video, ArrowLeft, Play, AlertTriangle, Cpu } from 'lucide-react';
import { AIInterviewer } from './interview/AIInterviewer';
import { RealTimeFeedback } from './interview/RealTimeFeedback';
import { VideoFeed } from './interview/VideoFeed';
import { SessionControls } from './interview/SessionControls';
import { FeedbackReport } from './interview/FeedbackReport';
import { FaceAnalysisService, FaceAnalysisData } from '../services/faceAnalysisService';
import { SpeechAnalysisService, SpeechAnalysisData } from '../services/speechAnalysisService';
import { WhisperService, WhisperProgress } from '../services/whisperService';
import { SessionStorageService, SessionRecord } from '../services/sessionStorageService';

type User = {
  id: string;
  name: string;
  email: string;
  subscription: 'free' | 'premium' | 'professional';
};

type InterviewSession = {
  id: string;
  type: 'quick' | 'full' | 'technical' | 'behavioral';
  duration: number;
  questions: string[];
  currentQuestion: number;
  isActive: boolean;
  startTime?: Date;
  feedback: {
    speech: Record<string, unknown>;
    visual: Record<string, unknown>;
    content: Record<string, unknown>;
  };
};

type Props = {
  user: User;
  onBack: () => void;
  autoStartType?: string;  // If provided, auto-start this interview type immediately
};

export function InterviewPractice({ onBack, autoStartType }: Props) {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Whisper loading state
  const [whisperProgress, setWhisperProgress] = useState<WhisperProgress | null>(null);
  const [whisperReady, setWhisperReady] = useState(false);

  // Real-time feedback data from AI services
  const [faceData, setFaceData] = useState<FaceAnalysisData | null>(null);
  const [speechData, setSpeechData] = useState<SpeechAnalysisData | null>(null);

  // Session results for the feedback report
  const [sessionResult, setSessionResult] = useState<SessionRecord | null>(null);

  // Hardware check state
  const [mediaStatus, setMediaStatus] = useState<{
    camera: 'checking' | 'ready' | 'error';
    mic: 'checking' | 'ready' | 'error';
    stream: MediaStream | null;
  }>({ camera: 'checking', mic: 'checking', stream: null });

  // Fullscreen container
  const interviewContainerRef = useRef<HTMLDivElement>(null);

  // Running averages for session-wide scoring
  const eyeContactSamples = useRef<number[]>([]);
  const confidenceSamples = useRef<number[]>([]);
  const postureSamples = useRef<number[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // AI Services
  const faceServiceRef = useRef<FaceAnalysisService | null>(null);
  const speechServiceRef = useRef<SpeechAnalysisService | null>(null);
  const whisperServiceRef = useRef<WhisperService | null>(null);
  const sessionStorageRef = useRef<SessionStorageService | null>(null);

  const stopInterview = useCallback(async () => {
    // Exit fullscreen
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* ignore */ }
    }

    // Stop Whisper capture
    if (whisperServiceRef.current) {
      await whisperServiceRef.current.stopCapture();
    }

    // Stop AI services and collect final data
    faceServiceRef.current?.stop();
    const finalSpeechData = speechServiceRef.current?.stop();

    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }

    // Stop all tracks on the stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }

    // Calculate session-wide averages — default to 0 if no data
    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const hasSpeech = (finalSpeechData?.totalWords ?? 0) > 0;
    const hasVisual = eyeContactSamples.current.length > 0;

    const eyeContactScore = avg(eyeContactSamples.current);
    const confidenceScore = avg(confidenceSamples.current);
    const bodyLanguageScore = avg(postureSamples.current);

    const speechClarityScore = hasSpeech ? (finalSpeechData?.clarity ?? 70) : 0;
    const wpm = finalSpeechData?.wordsPerMinute ?? 0;
    const paceScore = hasSpeech ? (wpm >= 100 && wpm <= 160 ? 85 : wpm > 0 ? 60 : 70) : 0;

    const scores = {
      eyeContact: eyeContactScore,
      speechClarity: speechClarityScore,
      bodyLanguage: bodyLanguageScore,
      contentQuality: hasSpeech ? Math.round((speechClarityScore + confidenceScore) / 2) : 0,
      confidence: confidenceScore,
      speakingPace: paceScore
    };

    // Overall score: if no participation, score is 0. Otherwise use weighted avg.
    let overallScore = 0;
    if (hasSpeech || hasVisual) {
      overallScore = Math.round(
        (scores.eyeContact * 0.25) +
        (scores.speechClarity * 0.2) +
        (scores.bodyLanguage * 0.15) +
        (scores.contentQuality * 0.15) +
        (scores.confidence * 0.15) +
        (scores.speakingPace * 0.1)
      );
    }

    let strengths: string[] = [];
    let improvements: string[] = [];

    try {
      const { AIProviderService } = await import('../services/aiProviderService');
      const aiFeedback = await AIProviderService.generateFeedback(
        session?.type || 'quick',
        finalSpeechData?.transcript || '',
        scores
      );
      strengths = aiFeedback.strengths;
      improvements = aiFeedback.improvements;
    } catch (error) {
      console.warn('AI Feedback generation failed, falling back to rule-based feedback:', error);
      const fallback = SessionStorageService.generateFeedback(
        scores,
        finalSpeechData?.fillerWordCount ?? 0,
        wpm
      );
      strengths = fallback.strengths;
      improvements = fallback.improvements;
    }

    const sessionRecord: SessionRecord = {
      id: session?.id || Date.now().toString(),
      type: session?.type || 'quick',
      date: new Date().toISOString(),
      duration: session?.startTime ? Math.round((Date.now() - session.startTime.getTime()) / 1000) : 0,
      questionsCount: session?.questions.length || 0,
      questionsAnswered: (session?.currentQuestion || 0) + 1,
      transcript: finalSpeechData?.transcript || '',
      overallScore,
      scores,
      fillerWordCount: finalSpeechData?.fillerWordCount ?? 0,
      fillerWords: finalSpeechData?.fillerWords ?? [],
      wordsPerMinute: wpm,
      totalWords: finalSpeechData?.totalWords ?? 0,
      longestSilence: finalSpeechData?.longestSilence ?? 0,
      strengths,
      improvements
    };

    // Save to IndexedDB
    try {
      await sessionStorageRef.current?.saveSession(sessionRecord);
    } catch {
      console.error('Failed to save session');
    }

    setSessionResult(sessionRecord);
    setIsRecording(false);
    setShowReport(true);

    // Cleanup services
    faceServiceRef.current?.destroy();
    speechServiceRef.current?.destroy();
    whisperServiceRef.current?.destroy();
    faceServiceRef.current = null;
    speechServiceRef.current = null;
    whisperServiceRef.current = null;
  }, [session]);

  // Initialize session storage on mount
  useEffect(() => {
    const storage = new SessionStorageService();
    storage.initialize().then(() => {
      sessionStorageRef.current = storage;
    });
  }, []);

  // Track if we came from dashboard with a pre-selected type
  const [pendingStartType, setPendingStartType] = useState<string | undefined>(autoStartType);

  // Hardware check effect
  useEffect(() => {
    if (pendingStartType && !isInitializing && !session) {
      let activeStream: MediaStream | null = null;

      const checkMedia = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          activeStream = stream;
          setMediaStatus({ camera: 'ready', mic: 'ready', stream });
        } catch (err) {
          console.error('Media check failed:', err);
          // Try to check individual permissions
          try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setMediaStatus(prev => ({ ...prev, camera: 'ready', stream: videoStream }));
            activeStream = videoStream;
          } catch {
            setMediaStatus(prev => ({ ...prev, camera: 'error' }));
          }

          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            setMediaStatus(prev => ({ ...prev, mic: 'ready' }));
          } catch {
            setMediaStatus(prev => ({ ...prev, mic: 'error' }));
          }
        }
      };

      checkMedia();

      return () => {
        if (activeStream) {
          activeStream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [pendingStartType, isInitializing, session]);

  // Handle Fullscreen interruption
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (session && !document.fullscreenElement && isRecording) {
        // User exited fullscreen — stop the interview
        stopInterview();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [session, isRecording, stopInterview]);

  const interviewTypes = [
    {
      id: 'quick',
      name: 'Quick Practice',
      duration: '5-10 min',
      description: 'Short session with basic questions',
      questions: 5
    },
    {
      id: 'full',
      name: 'Full Interview',
      duration: '45-60 min',
      description: 'Comprehensive mock interview',
      questions: 12
    },
    {
      id: 'technical',
      name: 'Technical Focus',
      duration: '30 min',
      description: 'Role-specific technical questions',
      questions: 8
    },
    {
      id: 'behavioral',
      name: 'Behavioral Questions',
      duration: '25 min',
      description: 'STAR method and soft skills',
      questions: 8
    }
  ];

  const handleFaceData = useCallback((data: FaceAnalysisData) => {
    setFaceData(data);
    if (data.faceDetected) {
      eyeContactSamples.current.push(data.eyeContact);
      confidenceSamples.current.push(data.confidence);
      postureSamples.current.push(data.posture === 'excellent' ? 95 : data.posture === 'good' ? 70 : 40);
    }
  }, []);

  const handleSpeechData = useCallback((data: SpeechAnalysisData) => {
    setSpeechData(data);
  }, []);

  const startInterview = async (type: string) => {
    setInitError(null);
    setIsInitializing(true);
    setWhisperProgress(null);
    setWhisperReady(false);

    // Request fullscreen immediately (must be in user gesture callstack)
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen not supported or denied — continue anyway
    }

    try {
      // Request camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      mediaStreamRef.current = stream;

      // Try to assign immediately if possible
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Initialize face analysis gracefully
      const faceService = new FaceAnalysisService();
      try {
        await faceService.initialize();
        faceServiceRef.current = faceService;
      } catch {
        console.warn('[Interview] FaceAnalysisService failed to initialize, continuing without face tracking');
      }

      // Initialize Whisper for speech recognition
      const whisperService = new WhisperService();
      whisperServiceRef.current = whisperService;

      try {
        await whisperService.loadModel((progress) => {
          setWhisperProgress(progress);
        });
        setWhisperReady(true);
      } catch {
        console.warn('[Interview] Whisper failed to load, falling back to Web Speech API');
        // Fallback to Web Speech API
        setWhisperReady(false);
        whisperServiceRef.current = null;
      }

      // Initialize speech analysis service (for filler detection, WPM, etc.)
      const speechService = new SpeechAnalysisService();
      speechServiceRef.current = speechService;

      // Reset samples
      eyeContactSamples.current = [];
      confidenceSamples.current = [];
      postureSamples.current = [];

      // Create new session
      const newSession: InterviewSession = {
        id: Date.now().toString(),
        type: type as InterviewSession['type'],
        duration: 0,
        questions: generateQuestions(type),
        currentQuestion: 0,
        isActive: true,
        startTime: new Date(),
        feedback: {
          speech: {},
          visual: {},
          content: {}
        }
      };

      setSession(newSession);
      setIsRecording(true);
      setIsInitializing(false);

      // Start AI analysis after a brief delay for video to mount
      setTimeout(() => {
        // Ensure stream is assigned after component mounts
        if (videoRef.current && !videoRef.current.srcObject) {
          videoRef.current.srcObject = stream;
        }

        if (videoRef.current && faceServiceRef.current) {
          faceServiceRef.current.start(videoRef.current, handleFaceData);
          if (canvasRef.current) {
            faceServiceRef.current.setOverlayCanvas(canvasRef.current);
          }
        }

        // Start speech analysis
        if (whisperServiceRef.current) {
          // Whisper mode: start analysis-only (no Web Speech API)
          speechService.startAnalysisOnly(handleSpeechData);

          // Start Whisper audio capture
          whisperServiceRef.current.startCapture(stream, (event) => {
            // Feed Whisper's transcript into the speech analysis pipeline
            speechService.processExternalTranscript(event.newSegment);
          });
        } else {
          // Fallback: use Web Speech API
          if (SpeechAnalysisService.isSupported()) {
            speechService.initialize();
            speechService.start(handleSpeechData);
          }
        }
      }, 1000);

      // Start media recording
      try {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
      } catch {
        // MediaRecorder not supported — that's fine
      }

    } catch (error) {
      console.error('Error starting interview:', error);
      setIsInitializing(false);
      if (error instanceof Error && error.message.includes('Permission')) {
        setInitError('Please allow camera and microphone access to start the interview.');
      } else {
        setInitError('Failed to initialize AI analysis. Please try again.');
      }
    }
  };



  const handleToggleMic = () => {
    const newMicState = !micEnabled;
    setMicEnabled(newMicState);

    // Actually mute/unmute the audio stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = newMicState;
      });
    }

    // Tell Whisper to pause/resume
    if (whisperServiceRef.current) {
      whisperServiceRef.current.setMuted(!newMicState);
    }
  };

  const handleSkipQuestion = () => {
    if (!session) return;
    const nextIndex = session.currentQuestion + 1;
    if (nextIndex < session.questions.length) {
      setSession(prev => prev ? { ...prev, currentQuestion: nextIndex } : null);
    }
  };

  const handleRepeatQuestion = () => {
    // Force re-render of the current question (trigger animation)
    if (!session) return;
    const current = session.currentQuestion;
    setSession(prev => prev ? { ...prev, currentQuestion: -1 } : null);
    setTimeout(() => {
      setSession(prev => prev ? { ...prev, currentQuestion: current } : null);
    }, 100);
  };

  const generateQuestions = (type: string): string[] => {
    const questionBank = {
      quick: [
        "Tell me about yourself.",
        "Why are you interested in this position?",
        "What are your greatest strengths?",
        "Where do you see yourself in 5 years?",
        "Do you have any questions for us?"
      ],
      full: [
        "Tell me about yourself.",
        "Why do you want to work here?",
        "Describe a challenging project you worked on.",
        "How do you handle stress and pressure?",
        "Where do you see yourself in 5 years?",
        "Tell me about a time you failed.",
        "Why are you leaving your current job?",
        "What are your salary expectations?",
        "Do you have any questions for us?",
        "Describe your ideal work environment.",
        "How do you prioritize your work?",
        "Tell me about a time you worked in a team."
      ],
      technical: [
        "Explain your approach to problem-solving.",
        "Describe a complex technical challenge you solved.",
        "How do you stay updated with new technologies?",
        "Walk me through your development process.",
        "How do you handle code reviews?",
        "Explain a time you optimized system performance.",
        "How do you approach debugging?",
        "Describe your experience with testing."
      ],
      behavioral: [
        "Tell me about a time you showed leadership.",
        "Describe a conflict you resolved at work.",
        "Give an example of when you went above and beyond.",
        "Tell me about a time you made a mistake.",
        "Describe a situation where you had to learn quickly.",
        "How do you handle constructive criticism?",
        "Tell me about a time you had to make a difficult decision.",
        "Describe how you manage competing deadlines."
      ]
    };

    return questionBank[type as keyof typeof questionBank] || questionBank.quick;
  };

  // Build the real-time feedback object for the RealTimeFeedback component
  const realTimeFeedback = {
    eyeContact: faceData?.eyeContact ?? 0,
    speakingPace: speechData?.speakingPace ?? 'good' as const,
    posture: faceData?.posture ?? 'good' as const,
    fillerWords: speechData?.fillerWordCount ?? 0,
    confidence: faceData?.confidence ?? 0,
    wordsPerMinute: speechData?.wordsPerMinute ?? 0,
    faceDetected: faceData?.faceDetected ?? false,
    transcript: speechData?.transcript ?? '',
    interimTranscript: speechData?.interimTranscript ?? '',
    clarity: speechData?.clarity ?? 80,
    totalWords: speechData?.totalWords ?? 0,
    fillerWordList: speechData?.fillerWords ?? [],
    silenceDuration: speechData?.silenceDuration ?? 0,
    whisperActive: whisperReady
  };

  if (showReport && sessionResult) {
    return (
      <FeedbackReport
        sessionResult={sessionResult}
        onClose={() => {
          setShowReport(false);
          setSession(null);
          setSessionResult(null);
        }}
        onRetry={() => {
          setShowReport(false);
          setSessionResult(null);
          if (session) startInterview(session.type);
        }}
        onBack={onBack}
      />
    );
  }

  if (session && isRecording) {
    return (
      <div ref={interviewContainerRef} className="h-screen bg-gray-900 text-white overflow-hidden">
        <div className="flex h-full">
          {/* Left Panel - AI Interviewer */}
          <div className="w-full md:w-1/2 p-6 border-r border-gray-700 flex flex-col overflow-y-auto">
            <AIInterviewer
              session={session}
              userTranscript={speechData?.transcript || ''}
              onQuestionChange={(questionIndex) =>
                setSession(prev => prev ? { ...prev, currentQuestion: questionIndex } : null)
              }
              onFinishInterview={stopInterview}
            />
          </div>

          {/* Right Panel - User Video & Feedback */}
          <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto">
            <div className="flex-1 space-y-4 max-w-2xl w-full mx-auto">
              {/* User Video Feed with AI overlay */}
              <VideoFeed
                videoRef={videoRef}
                canvasRef={canvasRef}
                cameraEnabled={cameraEnabled}
                onToggleCamera={() => setCameraEnabled(!cameraEnabled)}
                faceDetected={faceData?.faceDetected ?? false}
                eyeContact={faceData?.eyeContact ?? 0}
              />

              {/* Real-time Feedback — now with REAL data */}
              <RealTimeFeedback feedback={realTimeFeedback} />

              {/* Session Controls */}
              <SessionControls
                session={session}
                isRecording={isRecording}
                micEnabled={micEnabled}
                onToggleMic={handleToggleMic}
                onStop={stopInterview}
                onSkipQuestion={handleSkipQuestion}
                onRepeatQuestion={handleRepeatQuestion}
                canSkip={session.currentQuestion < session.questions.length - 1}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pre-selected interview type from dashboard — show confirmation screen
  if (pendingStartType && !isInitializing) {
    const selectedType = interviewTypes.find(t => t.id === pendingStartType);
    const isReady = mediaStatus.camera === 'ready' && mediaStatus.mic === 'ready';

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
            <Cpu className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Ready to Begin</h1>
          <p className="text-gray-400 mb-2 text-lg capitalize">{selectedType?.name || pendingStartType} Interview</p>
          <p className="text-gray-500 mb-8 text-sm">{selectedType?.description} • {selectedType?.questions} questions</p>

          <div className="space-y-4 mb-8">
            {/* Media Preview / Hardware Status */}
            <div className="bg-black/40 rounded-xl overflow-hidden border border-white/10 aspect-video relative flex items-center justify-center">
              {mediaStatus.stream && mediaStatus.camera === 'ready' ? (
                <video
                  autoPlay
                  muted
                  playsInline
                  ref={(el) => { if (el) el.srcObject = mediaStatus.stream; }}
                  className="w-full h-full object-cover mirror"
                />
              ) : (
                <div className="text-gray-500 flex flex-col items-center gap-2">
                  <Camera className="w-8 h-8 opacity-20" />
                  <span className="text-xs">Camera Preview Unavailable</span>
                </div>
              )}

              <div className="absolute bottom-3 left-3 right-3 flex justify-between gap-2">
                <div className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-2 backdrop-blur-md ${mediaStatus.camera === 'ready' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  mediaStatus.camera === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-white/10 text-gray-400 border border-white/10'
                  }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${mediaStatus.camera === 'ready' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                  Camera {mediaStatus.camera === 'ready' ? 'Active' : mediaStatus.camera === 'error' ? 'Error' : 'Checking...'}
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-2 backdrop-blur-md ${mediaStatus.mic === 'ready' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  mediaStatus.mic === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-white/10 text-gray-400 border border-white/10'
                  }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${mediaStatus.mic === 'ready' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                  Microphone {mediaStatus.mic === 'ready' ? 'Active' : mediaStatus.mic === 'error' ? 'Error' : 'Checking...'}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-left bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 text-gray-300 text-xs">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>Whisper AI runs locally in your browser</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300 text-xs">
                <Video className="w-3.5 h-3.5 text-green-400" />
                <span>Session enters fullscreen for focus</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (mediaStatus.stream) {
                mediaStatus.stream.getTracks().forEach(t => t.stop());
              }
              setPendingStartType(undefined);
              startInterview(pendingStartType);
            }}
            disabled={!isReady}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all shadow-lg flex items-center justify-center gap-3 ${isReady
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-blue-500/25'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
              }`}
          >
            <Play className="w-6 h-6" />
            {isReady ? 'Start Interview' : 'Checking Hardware...'}
          </button>

          <button
            onClick={() => {
              if (mediaStatus.stream) {
                mediaStatus.stream.getTracks().forEach(t => t.stop());
              }
              setPendingStartType(undefined);
              onBack();
            }}
            className="mt-4 text-gray-500 hover:text-gray-300 transition-colors text-sm"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show loading state during initialization (Whisper download, camera setup)
  if (isInitializing) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          {whisperProgress ? (
            <div className="bg-white/5 rounded-xl p-8 border border-white/10">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Cpu className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Loading AI Speech Engine</h2>
              <p className="text-gray-400 text-sm mb-6">Powered by OpenAI Whisper • Runs locally in your browser</p>
              <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${whisperProgress.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{whisperProgress.message}</p>
            </div>
          ) : (
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-6"></div>
              <p className="text-white font-medium">Initializing AI Analysis Engine...</p>
              <p className="text-gray-400 text-sm mt-2">Requesting camera and microphone access</p>
            </div>
          )}

          {initError && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-red-300 font-medium">{initError}</p>
                <p className="text-red-400/70 text-sm mt-1">Make sure you have allowed camera/mic permissions.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Interview Practice</h1>
          <div className="w-24"></div>
        </div>

        {/* Interview Type Selection */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {interviewTypes.map((type) => (
            <div
              key={type.id}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-200"
              onClick={() => !isInitializing && startInterview(type.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{type.name}</h3>
                <Play className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600 mb-3">{type.description}</p>
              <div className="flex justify-between text-sm">
                <span className="text-blue-600 font-medium">{type.duration}</span>
                <span className="text-gray-500">{type.questions} questions</span>
              </div>
            </div>
          ))}
        </div>

        {/* Features Overview */}
        <div className="bg-white rounded-xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Real AI-Powered Analysis</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Face & Eye Tracking</h3>
              <p className="text-sm text-gray-600">MediaPipe AI tracks your eye contact, head pose, and facial expressions in real-time</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Whisper Speech AI</h3>
              <p className="text-sm text-gray-600">OpenAI Whisper runs locally for accurate transcription, filler word detection, and pace analysis</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Smart Feedback</h3>
              <p className="text-sm text-gray-600">All analysis runs locally in your browser — no data sent to servers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}