import { ArrowLeft, RotateCcw, Download, TrendingUp, Eye, Volume2, MessageSquare, Award, Gauge, Users, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { SessionRecord } from '../../services/sessionStorageService';


type Props = {
  sessionResult: SessionRecord;
  onClose: () => void;
  onRetry: () => void;
  onBack: () => void;
};

export function FeedbackReport({ sessionResult, onClose, onRetry, onBack }: Props) {
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

  const getGrade = (score: number): string => {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    return 'D';
  };

  const handleDownload = () => {
    const report = {
      title: 'InterviewAce Session Report',
      date: new Date(sessionResult.date).toLocaleDateString(),
      type: sessionResult.type,
      duration: formatDuration(sessionResult.duration),
      overallScore: sessionResult.overallScore,
      grade: getGrade(sessionResult.overallScore),
      scores: sessionResult.scores,
      fillerWords: sessionResult.fillerWords,
      fillerWordCount: sessionResult.fillerWordCount,
      wordsPerMinute: sessionResult.wordsPerMinute,
      totalWords: sessionResult.totalWords,
      strengths: sessionResult.strengths,
      improvements: sessionResult.improvements,
      transcript: sessionResult.transcript
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interviewace-report-${new Date(sessionResult.date).toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categories = [
    { key: 'eyeContact', label: 'Eye Contact', icon: Eye, score: sessionResult.scores.eyeContact },
    { key: 'speechClarity', label: 'Speech Clarity', icon: Volume2, score: sessionResult.scores.speechClarity },
    { key: 'bodyLanguage', label: 'Body Language', icon: Users, score: sessionResult.scores.bodyLanguage },
    { key: 'contentQuality', label: 'Content Quality', icon: MessageSquare, score: sessionResult.scores.contentQuality },
    { key: 'confidence', label: 'Confidence', icon: TrendingUp, score: sessionResult.scores.confidence },
    { key: 'speakingPace', label: 'Speaking Pace', icon: Gauge, score: sessionResult.scores.speakingPace },
  ];

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
            <button 
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              title="Download report"
            >
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
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - sessionResult.overallScore / 100)}`}
                  className={getScoreColor(sessionResult.overallScore)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-800">{sessionResult.overallScore}</div>
                  <div className="text-sm text-gray-600">Score</div>
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Grade: {getGrade(sessionResult.overallScore)}
            </h2>
            <div className="flex justify-center gap-4 text-sm text-gray-500 flex-wrap">
              <span>Duration: {formatDuration(sessionResult.duration)}</span>
              <span>•</span>
              <span>Questions: {sessionResult.questionsAnswered}/{sessionResult.questionsCount}</span>
              <span>•</span>
              <span className="capitalize">{sessionResult.type} Interview</span>
              <span>•</span>
              <span>{sessionResult.totalWords} words spoken</span>
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
            {categories.map(({ key, label, icon: Icon, score }) => (
              <div key={key} className="flex items-start gap-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-800">{label}</h4>
                    <span className={`font-bold ${getScoreColor(score)}`}>
                      {score}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreBgColor(score)}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Speech Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl p-6 shadow-lg mb-8"
        >
          <h3 className="text-xl font-bold text-gray-800 mb-6">Speech Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600">{sessionResult.wordsPerMinute}</div>
              <div className="text-sm text-gray-600">Words/Min</div>
              <div className="text-xs text-gray-400 mt-1">Ideal: 120-150</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className={`text-2xl font-bold ${sessionResult.fillerWordCount > 5 ? 'text-red-500' : sessionResult.fillerWordCount > 2 ? 'text-yellow-500' : 'text-green-500'}`}>
                {sessionResult.fillerWordCount}
              </div>
              <div className="text-sm text-gray-600">Filler Words</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-purple-600">{sessionResult.totalWords}</div>
              <div className="text-sm text-gray-600">Total Words</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className={`text-2xl font-bold ${sessionResult.longestSilence > 8 ? 'text-red-500' : 'text-green-500'}`}>
                {sessionResult.longestSilence}s
              </div>
              <div className="text-sm text-gray-600">Longest Pause</div>
            </div>
          </div>

          {/* Filler Word Breakdown */}
          {sessionResult.fillerWords.length > 0 && (
            <div className="mt-4 p-4 bg-orange-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h4 className="font-medium text-orange-800">Filler Words Detected</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {sessionResult.fillerWords.map((fw, i) => (
                  <span key={i} className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm">
                    "{fw.word}" × {fw.count}
                  </span>
                ))}
              </div>
            </div>
          )}
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
              {sessionResult.strengths.map((strength, index) => (
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
              {sessionResult.improvements.map((improvement, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-700">{improvement}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Transcript */}
        {sessionResult.transcript && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-xl p-6 shadow-lg mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-bold text-gray-800">Full Transcript</h3>
            </div>
            <div className="max-h-48 overflow-y-auto p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {sessionResult.transcript}
              </p>
            </div>
          </motion.div>
        )}

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