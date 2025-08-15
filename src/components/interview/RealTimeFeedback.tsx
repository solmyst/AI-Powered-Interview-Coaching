import React from 'react';
import { Eye, Volume2, Users, AlertTriangle, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

type FeedbackData = {
  eyeContact: number;
  speakingPace: 'slow' | 'good' | 'fast';
  posture: 'poor' | 'good' | 'excellent';
  fillerWords: number;
  confidence: number;
};

type Props = {
  feedback: FeedbackData;
};

export function RealTimeFeedback({ feedback }: Props) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getPaceColor = (pace: string) => {
    switch (pace) {
      case 'good': return 'text-green-500';
      case 'slow': return 'text-yellow-500';
      case 'fast': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getPostureColor = (posture: string) => {
    switch (posture) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        Real-time Feedback
      </h3>

      <div className="space-y-4">
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
            <div className="w-16 bg-gray-700 rounded-full h-2">
              <motion.div
                className="bg-blue-500 h-2 rounded-full"
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
            <Volume2 className="w-4 h-4 text-green-400" />
            <span className="text-gray-300 text-sm">Speaking Pace</span>
          </div>
          <span className={`text-sm font-medium capitalize ${getPaceColor(feedback.speakingPace)}`}>
            {feedback.speakingPace}
          </span>
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
          <span className={`text-sm font-medium ${feedback.fillerWords > 5 ? 'text-red-500' : 'text-green-500'}`}>
            {feedback.fillerWords}
          </span>
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
            <div className="w-16 bg-gray-700 rounded-full h-2">
              <motion.div
                className="bg-indigo-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${feedback.confidence}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="mt-4 p-3 bg-gray-700 rounded-lg">
        <h4 className="text-sm font-medium text-white mb-2">Quick Tip</h4>
        <p className="text-xs text-gray-300">
          {feedback.eyeContact < 70 && "Try to look directly at the camera more often to maintain eye contact."}
          {feedback.fillerWords > 5 && "Take brief pauses instead of using filler words like 'um' or 'uh'."}
          {feedback.speakingPace === 'fast' && "Slow down your speaking pace for better clarity."}
          {feedback.speakingPace === 'slow' && "Try to speak a bit faster to maintain engagement."}
          {feedback.posture === 'poor' && "Sit up straight and maintain good posture."}
          {feedback.eyeContact >= 70 && feedback.fillerWords <= 5 && feedback.posture !== 'poor' && 
           "Great job! Keep maintaining this level of performance."}
        </p>
      </div>
    </div>
  );
}