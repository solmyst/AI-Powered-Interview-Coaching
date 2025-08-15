import React, { useState, useRef } from 'react';
import { Camera, Mic, Video, ArrowLeft, Play } from 'lucide-react';
import { AIInterviewer } from './interview/AIInterviewer';
import { RealTimeFeedback } from './interview/RealTimeFeedback';
import { VideoFeed } from './interview/VideoFeed';
import { SessionControls } from './interview/SessionControls';
import { FeedbackReport } from './interview/FeedbackReport';

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
};

export function InterviewPractice({ onBack }: Props) {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [realTimeFeedback] = useState({
    eyeContact: 85,
    speakingPace: 'good',
    posture: 'excellent',
    fillerWords: 2,
    confidence: 78
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const interviewTypes = [
    {
      id: 'quick',
      name: 'Quick Practice',
      duration: '5-10 min',
      description: 'Short session with basic questions',
      questions: 3
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
      questions: 6
    }
  ];

  const startInterview = async (type: string) => {
    try {
      // Request camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

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

      // Start media recording
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

    } catch (error) {
      console.error('Error starting interview:', error);
      alert('Please allow camera and microphone access to start the interview.');
    }
  };

  const stopInterview = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }

    setIsRecording(false);
    setShowReport(true);
  };

  const generateQuestions = (type: string): string[] => {
    const questionBank = {
      quick: [
        "Tell me about yourself.",
        "Why are you interested in this position?",
        "What are your greatest strengths?"
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
        "How do you handle constructive criticism?"
      ]
    };

    return questionBank[type as keyof typeof questionBank] || questionBank.quick;
  };

  if (showReport && session) {
    return (
      <FeedbackReport
        session={session}
        onClose={() => {
          setShowReport(false);
          setSession(null);
        }}
        onRetry={() => {
          setShowReport(false);
          startInterview(session.type);
        }}
        onBack={onBack}
      />
    );
  }

  if (session && isRecording) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="flex h-screen">
          {/* Left Panel - AI Interviewer */}
          <div className="w-1/2 p-6 border-r border-gray-700">
            <AIInterviewer
              session={session}
              onQuestionChange={(questionIndex) => 
                setSession(prev => prev ? {...prev, currentQuestion: questionIndex} : null)
              }
            />
          </div>

          {/* Right Panel - User Video & Feedback */}
          <div className="w-1/2 p-6">
            <div className="space-y-4">
              {/* User Video Feed */}
              <VideoFeed
                videoRef={videoRef}
                cameraEnabled={cameraEnabled}
                onToggleCamera={() => setCameraEnabled(!cameraEnabled)}
              />

              {/* Real-time Feedback */}
              <RealTimeFeedback feedback={realTimeFeedback} />

              {/* Session Controls */}
              <SessionControls
                session={session}
                isRecording={isRecording}
                micEnabled={micEnabled}
                onToggleMic={() => setMicEnabled(!micEnabled)}
                onStop={stopInterview}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
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
              onClick={() => startInterview(type.id)}
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
          <h2 className="text-2xl font-bold text-gray-800 mb-6">What You'll Get</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Body Language Analysis</h3>
              <p className="text-sm text-gray-600">Real-time feedback on posture, eye contact, and gestures</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Speech Analysis</h3>
              <p className="text-sm text-gray-600">Pace, clarity, filler words, and confidence detection</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">AI Interviewer</h3>
              <p className="text-sm text-gray-600">Dynamic questions with intelligent follow-ups</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}