import React from 'react';
import { ArrowLeft, RotateCcw, Download, Share2, TrendingUp, Eye, Volume2, MessageSquare, Award } from 'lucide-react';
import { motion } from 'framer-motion';

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
  session: InterviewSession;
  onClose: () => void;
  onRetry: () => void;
  onBack: () => void;
};

export function FeedbackReport({ session, onClose, onRetry, onBack }: Props) {
  // Mock data for demonstration - in real app this would come from AI analysis
  const analysisResults = {
    overall: {
      score: 78,
      grade: 'B+',
      improvement: '+12%'
    },
    categories: {
      eyeContact: { score: 85, feedback: 'Excellent eye contact throughout the interview' },
      speechClarity: { score: 72, feedback: 'Good pace, but reduce filler words' },
      bodyLanguage: { score: 80, feedback: 'Confident posture, natural gestures' },
      contentQuality: { score: 75, feedback: 'Strong examples, could be more specific' }
    },
    strengths: [
      'Maintained excellent eye contact',
      'Spoke with confidence and clarity',
      'Used relevant examples from experience',
      'Showed enthusiasm for the role'
    ],
    improvements: [
      'Reduce filler words ("um", "uh") by 40%',
      'Provide more specific metrics in examples',
      'Practice STAR method for behavioral questions',
      'Slow down speaking pace slightly'
    ],
    keyMoments: [
      { time: '2:15', type: 'strength', note: 'Excellent leadership example' },
      { time: '5:42', type: 'improvement', note: 'Could be more specific about results' },
      { time: '8:30', type: 'strength', note: 'Great follow-up question' }
    ]
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Interview Report</h1>
          <div className="flex gap-2">
            <button className="p-2 text-gray-600 hover:text-gray-800 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-800 transition-colors">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Overall Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-8 shadow-lg mb-8"
        >
          <div className="text-center">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - analysisResults.overall.score / 100)}`}
                  className={getScoreColor(analysisResults.overall.score)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-800">{analysisResults.overall.score}</div>
                  <div className="text-sm text-gray-600">Score</div>
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Grade: {analysisResults.overall.grade}
            </h2>
            <p className="text-gray-600 mb-4">
              {analysisResults.overall.improvement} improvement from last session
            </p>
            <div className="flex justify-center gap-4 text-sm text-gray-500">
              <span>Duration: {formatDuration(session.duration || 1200)}</span>
              <span>•</span>
              <span>Questions: {session.questions.length}</span>
              <span>•</span>
              <span className="capitalize">{session.type} Interview</span>
            </div>
          </div>
        </motion.div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-lg mb-8"
        >
          <h3 className="text-xl font-bold text-gray-800 mb-6">Performance Breakdown</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(analysisResults.categories).map(([key, data]) => {
              const icons = {
                eyeContact: Eye,
                speechClarity: Volume2,
                bodyLanguage: TrendingUp,
                contentQuality: MessageSquare
              };
              const Icon = icons[key as keyof typeof icons];
              
              return (
                <div key={key} className="flex items-start gap-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-800 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>
                      <span className={`font-bold ${getScoreColor(data.score)}`}>
                        {data.score}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className={`h-2 rounded-full ${getScoreBgColor(data.score)}`}
                        style={{ width: `${data.score}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600">{data.feedback}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Strengths and Improvements */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-6 shadow-lg"
          >
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-bold text-gray-800">Strengths</h3>
            </div>
            <ul className="space-y-3">
              {analysisResults.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-6 shadow-lg"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-gray-800">Areas for Improvement</h3>
            </div>
            <ul className="space-y-3">
              {analysisResults.improvements.map((improvement, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-700">{improvement}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center gap-4"
        >
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Practice Again
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Save & Continue
          </button>
        </motion.div>
      </div>
    </div>
  );
}