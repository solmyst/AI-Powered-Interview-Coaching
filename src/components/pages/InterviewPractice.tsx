import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Mic, Video, ArrowLeft, Play, AlertTriangle, Cpu } from 'lucide-react';
import { AIInterviewer } from '../interview/AIInterviewer';
import { RealTimeFeedback } from '../interview/RealTimeFeedback';
import { VideoFeed } from '../interview/VideoFeed';
import { SessionControls } from '../interview/SessionControls';
import { FeedbackReport } from '../interview/FeedbackReport';
import { FaceAnalysisService, FaceAnalysisData } from '../../services/faceAnalysisService';
import { SpeechAnalysisService, SpeechAnalysisData } from '../../services/speechAnalysisService';
import { WhisperService, WhisperProgress } from '../../services/whisperService';
import { SessionStorageService, SessionRecord } from '../../services/sessionStorageService';
import { User, InterviewSession } from '../../types';

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
  const [showExitWarning, setShowExitWarning] = useState(false);

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
    
    const speechClarityScore = hasSpeech ? (finalSpeechData?.clarity ?? 0) : 0;
    const wpm = finalSpeechData?.wordsPerMinute ?? 0;
    const paceScore = hasSpeech ? (wpm >= 100 && wpm <= 160 ? 85 : wpm > 0 ? 60 : 70) : 0;

    const scores = {
      eyeContact: hasVisual ? eyeContactScore : 0,
      speechClarity: speechClarityScore,
      bodyLanguage: hasVisual ? bodyLanguageScore : 0,
      contentQuality: hasSpeech ? Math.round((speechClarityScore + confidenceScore) / 2) : 0,
      confidence: hasSpeech ? confidenceScore : 0,
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

    // Rule-based feedback (as fallback)
    let { strengths, improvements } = SessionStorageService.generateFeedback(
      scores,
      finalSpeechData?.fillerWordCount ?? 0,
      wpm
    );

    // Try to get AI-powered feedback if Ollama is available
    try {
      const { OllamaService } = await import('../../services/ollamaService');
      const aiFeedback = await OllamaService.generateSessionFeedback(
        session?.type || 'quick',
        finalSpeechData?.transcript || '',
        scores
      );
      if (aiFeedback.strengths.length > 0) strengths = aiFeedback.strengths;
      if (aiFeedback.improvements.length > 0) improvements = aiFeedback.improvements;
    } catch {
      // Use existing rule-based feedback
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
        setMediaStatus({ camera: 'checking', mic: 'checking', stream: null });
        
        try {
          // Try to get both first
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          activeStream = stream;
          
          const hasVideo = stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
          const hasAudio = stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled;
          
          setMediaStatus({ 
            camera: hasVideo ? 'ready' : 'error', 
            mic: hasAudio ? 'ready' : 'error', 
            stream 
          });
        } catch (err) {
          console.warn('[HardwareCheck] Combined check failed, trying individual:', err);
          
          let videoStream: MediaStream | null = null;
          let audioStream: MediaStream | null = null;
          let cameraStatus: 'ready' | 'error' = 'error';
          let micStatus: 'ready' | 'error' = 'error';

          // Individual Camera Check
          try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoStream.getVideoTracks().length > 0) {
              cameraStatus = 'ready';
            }
          } catch (e) {
            console.error('[HardwareCheck] Camera individual check failed:', e);
            cameraStatus = 'error';
          }

          // Individual Mic Check
          try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioStream.getAudioTracks().length > 0) {
              micStatus = 'ready';
            }
          } catch (e) {
            console.error('[HardwareCheck] Mic individual check failed:', e);
            micStatus = 'error';
          }

          // Combine streams if possible
          if (videoStream && audioStream) {
            const combined = new MediaStream([...videoStream.getTracks(), ...audioStream.getTracks()]);
            activeStream = combined;
            setMediaStatus({ camera: cameraStatus, mic: micStatus, stream: combined });
          } else if (videoStream) {
            activeStream = videoStream;
            setMediaStatus({ camera: cameraStatus, mic: micStatus, stream: videoStream });
          } else if (audioStream) {
            activeStream = audioStream;
            setMediaStatus({ camera: cameraStatus, mic: micStatus, stream: audioStream });
          } else {
            setMediaStatus({ camera: 'error', mic: 'error', stream: null });
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
        // User exited fullscreen — show warning instead of stopping immediately
        setShowExitWarning(true);
      } else if (document.fullscreenElement) {
        // User returned to fullscreen
        setShowExitWarning(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [session, isRecording]);

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
    clarity: speechData?.clarity ?? 0,
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
      <div ref={interviewContainerRef} className="h-screen bg-[#0a0a0c] text-white overflow-hidden selection:bg-blue-500/30">
        <div className="flex h-full p-4 lg:p-8 gap-8">
          {/* Left Panel - AI Interviewer (60% width) */}
          <div className="w-full lg:w-[60%] flex flex-col">
            <div className="flex-1 bg-white/[0.02] border border-white/10 rounded-3xl backdrop-blur-3xl overflow-hidden flex flex-col shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-purple-500/[0.03] pointer-events-none" />
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                <AIInterviewer
                  session={session}
                  userTranscript={speechData?.transcript || ''}
                  onQuestionChange={(questionIndex: number) => 
                    setSession(prev => prev ? {...prev, currentQuestion: questionIndex} : null)
                  }
                  onFinishInterview={stopInterview}
                />
              </div>
            </div>
          </div>

          {/* Right Panel - User Video & Feedback (40% width) */}
          <div className="hidden lg:flex lg:w-[40%] flex-col gap-6">
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
              {/* User Video Feed with AI overlay */}
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl backdrop-blur-3xl overflow-hidden shadow-xl min-h-[240px] flex items-center justify-center relative">
                <div className="w-full h-full">
                  <VideoFeed
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                    cameraEnabled={cameraEnabled}
                    onToggleCamera={() => setCameraEnabled(!cameraEnabled)}
                    faceDetected={faceData?.faceDetected ?? false}
                    eyeContact={faceData?.eyeContact ?? 0}
                  />
                </div>
              </div>

              {/* Real-time Feedback */}
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl backdrop-blur-3xl p-6 shadow-xl">
                <RealTimeFeedback feedback={realTimeFeedback} />
              </div>

              {/* Session Controls */}
              <div className="mt-auto">
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

        {/* Exit Warning Modal */}
        {showExitWarning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Fullscreen Required</h2>
              <p className="text-gray-400 mb-8">
                To ensure a fair and focused interview environment, you must remain in fullscreen mode. 
                Leaving fullscreen will invalidate this session.
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    try {
                      await document.documentElement.requestFullscreen();
                      setShowExitWarning(false);
                    } catch (err) {
                      console.error('Failed to re-enter fullscreen:', err);
                    }
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
                >
                  Return to Fullscreen
                </button>
                <button
                  onClick={() => {
                    setShowExitWarning(false);
                    stopInterview();
                  }}
                  className="w-full py-3 bg-transparent border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
                >
                  End Interview Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Pre-selected interview type from dashboard — show confirmation screen
  if (pendingStartType && !isInitializing) {
    const selectedType = interviewTypes.find(t => t.id === pendingStartType);
    const isReady = mediaStatus.camera === 'ready' && mediaStatus.mic === 'ready';

    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        
        <div className="max-w-4xl w-full grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left: Info & Status */}
          <div className="space-y-8 text-left">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                System Ready
              </div>
              <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
                Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 text-6xl block mt-2">Practice?</span>
              </h1>
              <p className="text-gray-400 text-lg max-w-md leading-relaxed">
                Your AI-powered mock interview is prepared. We'll analyze your speech, posture, and confidence in real-time.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Selected Type</span>
                <span className="text-white font-semibold capitalize bg-white/10 px-3 py-1 rounded-lg border border-white/10">{selectedType?.name || pendingStartType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Questions</span>
                <span className="text-white font-semibold">{selectedType?.questions} Scenarios</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Est. Duration</span>
                <span className="text-white font-semibold">{selectedType?.duration}</span>
              </div>
              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    mediaStatus.camera === 'ready' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 
                    mediaStatus.camera === 'checking' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <span className="text-gray-300">
                    Camera: {
                      mediaStatus.camera === 'ready' ? 'Active & Ready' : 
                      mediaStatus.camera === 'checking' ? 'Checking Permissions...' : 'Access Blocked'
                    }
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    mediaStatus.mic === 'ready' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 
                    mediaStatus.mic === 'checking' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <span className="text-gray-300">
                    Microphone: {
                      mediaStatus.mic === 'ready' ? 'Active & Ready' : 
                      mediaStatus.mic === 'checking' ? 'Checking Permissions...' : 'Access Blocked'
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => {
                  if (mediaStatus.stream) {
                    mediaStatus.stream.getTracks().forEach(t => t.stop());
                  }
                  setPendingStartType(undefined);
                  startInterview(pendingStartType);
                }}
                disabled={!isReady}
                className={`group relative w-full py-5 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-3 overflow-hidden ${
                  isReady 
                    ? 'text-white' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed grayscale'
                }`}
              >
                {isReady && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 group-hover:scale-110 transition-transform duration-500" />
                )}
                <span className="relative flex items-center gap-3">
                  <Play className={`w-6 h-6 ${isReady ? 'fill-current' : ''}`} />
                  {isReady ? 'Begin Session' : 'Hardware Check Failed'}
                </span>
              </button>
              
              <button
                onClick={() => { 
                  if (mediaStatus.stream) {
                    mediaStatus.stream.getTracks().forEach(t => t.stop());
                  }
                  setPendingStartType(undefined); 
                  onBack(); 
                }}
                className="text-gray-500 hover:text-gray-300 transition-colors text-sm font-medium"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>

          {/* Right: Camera Preview */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000" />
            <div className="relative aspect-[4/3] bg-black rounded-3xl overflow-hidden border border-white/10 shadow-3xl">
              {mediaStatus.stream && mediaStatus.camera === 'ready' ? (
                <>
                  <video
                    autoPlay
                    muted
                    playsInline
                    ref={(el) => { if (el) el.srcObject = mediaStatus.stream; }}
                    className="w-full h-full object-cover mirror"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live Preview</span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-6 bg-gray-900/50">
                  <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Camera className="w-10 h-10 text-gray-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium mb-1">Camera Off</p>
                    <p className="text-gray-500 text-xs">Enable camera to continue</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Decorative corners */}
            <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-blue-500/50 rounded-tl-lg" />
            <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-purple-500/50 rounded-tr-lg" />
            <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-blue-500/50 rounded-bl-lg" />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-purple-500/50 rounded-br-lg" />
          </div>
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