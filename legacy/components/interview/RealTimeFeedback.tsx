import { Eye, Volume2, Users, AlertTriangle, TrendingUp, MessageSquare, Gauge, Type, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

type FeedbackData = {
  eyeContact: number;
  speakingPace: 'slow' | 'good' | 'fast';
  posture: 'poor' | 'good' | 'excellent';
  fillerWords: number;
  confidence: number;
  wordsPerMinute: number;
  faceDetected: boolean;
  transcript: string;
  interimTranscript: string;
  clarity: number;
  totalWords: number;
  fillerWordList: { word: string; count: number }[];
  silenceDuration: number;
  whisperActive?: boolean;
};

type Props = {
  feedback: FeedbackData;
};

export function RealTimeFeedback({ feedback }: Props) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPaceColor = (pace: string) => {
    switch (pace) {
      case 'good': return 'text-green-400';
      case 'slow': return 'text-yellow-400';
      case 'fast': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getPostureColor = (posture: string) => {
    switch (posture) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        Real-time Feedback
        {!feedback.faceDetected && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full ml-auto">
            No face detected
          </span>
        )}
        {feedback.faceDetected && (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full ml-auto">
            AI Active
          </span>
        )}
        {feedback.whisperActive && (
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            Whisper
          </span>
        )}
      </h3>

      <div className="space-y-3">
        {/* Eye Contact */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-gray-300 text-sm">Eye Contact</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getScoreColor(feedback.eyeContact)}`}>
              {feedback.eyeContact}%
            </span>
            <div className="w-20 bg-gray-700 rounded-full h-2">
              <motion.div
                className={`h-2 rounded-full ${getScoreBarColor(feedback.eyeContact)}`}
                initial={{ width: 0 }}
                animate={{ width: `${feedback.eyeContact}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Speaking Pace */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-green-400" />
            <span className="text-gray-300 text-sm">Speaking Pace</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium capitalize ${getPaceColor(feedback.speakingPace)}`}>
              {feedback.speakingPace}
            </span>
            <span className="text-xs text-gray-500">
              {feedback.wordsPerMinute > 0 ? `${feedback.wordsPerMinute} WPM` : '—'}
            </span>
          </div>
        </div>

        {/* Posture */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-gray-300 text-sm">Posture</span>
          </div>
          <span className={`text-sm font-medium capitalize ${getPostureColor(feedback.posture)}`}>
            {feedback.posture}
          </span>
        </div>

        {/* Filler Words */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-gray-300 text-sm">Filler Words</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${feedback.fillerWords > 5 ? 'text-red-400' : feedback.fillerWords > 2 ? 'text-yellow-400' : 'text-green-400'}`}>
              {feedback.fillerWords}
            </span>
            {feedback.fillerWordList.length > 0 && (
              <span className="text-xs text-gray-500">
                ({feedback.fillerWordList.slice(0, 2).map(f => `${f.word}:${f.count}`).join(', ')})
              </span>
            )}
          </div>
        </div>

        {/* Confidence Level */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span className="text-gray-300 text-sm">Confidence</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getScoreColor(feedback.confidence)}`}>
              {feedback.confidence}%
            </span>
            <div className="w-20 bg-gray-700 rounded-full h-2">
              <motion.div
                className={`h-2 rounded-full ${getScoreBarColor(feedback.confidence)}`}
                initial={{ width: 0 }}
                animate={{ width: `${feedback.confidence}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Clarity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <span className="text-gray-300 text-sm">Clarity</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getScoreColor(feedback.clarity)}`}>
              {feedback.clarity}%
            </span>
            <div className="w-20 bg-gray-700 rounded-full h-2">
              <motion.div
                className={`h-2 rounded-full ${getScoreBarColor(feedback.clarity)}`}
                initial={{ width: 0 }}
                animate={{ width: `${feedback.clarity}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Transcript */}
      <div className="mt-4 p-3 bg-gray-700 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <h4 className="text-sm font-medium text-white">Live Transcript</h4>
          <span className="text-xs text-gray-400 ml-auto">
            {feedback.totalWords} words
          </span>
        </div>
        <div className="max-h-24 overflow-y-auto">
          <p className="text-xs text-gray-300 leading-relaxed">
            {feedback.transcript || (
              <span className="text-gray-500 italic">Start speaking to see your transcript here...</span>
            )}
            {feedback.interimTranscript && (
              <span className="text-gray-500 italic"> {feedback.interimTranscript}</span>
            )}
          </p>
        </div>
      </div>

      {/* Silence Warning */}
      {feedback.silenceDuration > 5 && (
        <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Silence detected ({feedback.silenceDuration}s) — try to keep the conversation going
          </p>
        </div>
      )}

      {/* Quick Tips */}
      <div className="mt-3 p-3 bg-gray-700 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <Type className="w-3 h-3 text-yellow-400" />
          <h4 className="text-sm font-medium text-white">Quick Tip</h4>
        </div>
        <p className="text-xs text-gray-300">
          {!feedback.faceDetected && "Position your face in the center of the camera frame."}
          {feedback.faceDetected && feedback.eyeContact < 60 && "Look directly at the camera to maintain eye contact."}
          {feedback.faceDetected && feedback.fillerWords > 5 && "Take brief pauses instead of using filler words like 'um' or 'uh'."}
          {feedback.faceDetected && feedback.speakingPace === 'fast' && "Slow down your speaking pace for better clarity."}
          {feedback.faceDetected && feedback.speakingPace === 'slow' && "Try to speak a bit faster to maintain engagement."}
          {feedback.faceDetected && feedback.posture === 'poor' && "Sit up straight and face the camera directly."}
          {feedback.faceDetected && feedback.eyeContact >= 60 && feedback.fillerWords <= 5 && feedback.posture !== 'poor' && feedback.speakingPace === 'good' && 
           "Great job! Keep maintaining this level of performance."}
        </p>
      </div>
    </div>
  );
}