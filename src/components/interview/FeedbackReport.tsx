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
    if (score >= 80) return 'text-clay font-extrabold';
    if (score >= 60) return 'text-ash font-bold';
    return 'text-mist font-medium';
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
    <div className="min-h-screen bg-parchment p-6 sm:p-10 text-left font-sans text-ash">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-ash hover:text-void transition-colors font-bold"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          
          <h1 className="text-3xl font-bold font-serif text-void tracking-tight">Interview Report</h1>
          
          <div className="flex gap-2">
            <button 
              onClick={handleDownload}
              className="p-2.5 text-ash hover:text-void bg-vellum/45 border border-mist/20 rounded-xl transition-all shadow-sm"
              title="Download report JSON"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Overall Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-vellum/35 border border-mist/20 rounded-3xl p-8 shadow-sm mb-8"
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
                  className="text-vellum/60"
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
                  className="text-clay"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-void">{sessionResult.overallScore}</div>
                  <div className="text-xs font-bold text-mist uppercase tracking-wide">Overall</div>
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold font-serif text-void mb-2">
              Performance Grade: {getGrade(sessionResult.overallScore)}
            </h2>
            <div className="flex justify-center gap-4 text-xs font-semibold text-mist uppercase tracking-wider flex-wrap">
              <span>Duration: {formatDuration(sessionResult.duration)}</span>
              <span>•</span>
              <span>Questions: {sessionResult.questionsAnswered}/{sessionResult.questionsCount}</span>
              <span>•</span>
              <span>{sessionResult.type} Interview</span>
              <span>•</span>
              <span>{sessionResult.totalWords} words</span>
            </div>
          </div>
        </motion.div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-vellum/35 border border-mist/20 rounded-3xl p-6 sm:p-8 shadow-sm mb-8"
        >
          <h3 className="text-xl font-bold font-serif text-void mb-6 tracking-tight">Performance Breakdown</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {categories.map(({ key, label, icon: Icon, score }) => (
              <div key={key} className="flex items-start gap-4">
                <div className="p-2.5 bg-clay/10 border border-clay/10 rounded-xl">
                  <Icon className="w-5 h-5 text-clay" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-ash">{label}</h4>
                    <span className={`font-extrabold ${getScoreColor(score)}`}>
                      {score}%
                    </span>
                  </div>
                  <div className="w-full bg-vellum/60 rounded-full h-2.5 border border-mist/10">
                    <div
                      className="h-full rounded-full bg-clay transition-all duration-300"
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
          className="bg-vellum/35 border border-mist/20 rounded-3xl p-6 sm:p-8 shadow-sm mb-8"
        >
          <h3 className="text-xl font-bold font-serif text-void mb-6 tracking-tight">Speech Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-vellum/45 border border-mist/15 rounded-2xl">
              <div className="text-2xl font-extrabold text-clay">{sessionResult.wordsPerMinute}</div>
              <div className="text-xs font-bold text-mist uppercase tracking-wide mt-1">Words/Min</div>
              <div className="text-[10px] font-semibold text-ash/80 mt-1">Ideal: 120-150</div>
            </div>
            
            <div className="text-center p-4 bg-vellum/45 border border-mist/15 rounded-2xl">
              <div className="text-2xl font-extrabold text-clay">
                {sessionResult.fillerWordCount}
              </div>
              <div className="text-xs font-bold text-mist uppercase tracking-wide mt-1">Filler Words</div>
              <div className="text-[10px] font-semibold text-ash/80 mt-1">Goal: Minimal</div>
            </div>
            
            <div className="text-center p-4 bg-vellum/45 border border-mist/15 rounded-2xl">
              <div className="text-2xl font-extrabold text-void">{sessionResult.totalWords}</div>
              <div className="text-xs font-bold text-mist uppercase tracking-wide mt-1">Total Words</div>
              <div className="text-[10px] font-semibold text-ash/80 mt-1">Spoken Content</div>
            </div>
            
            <div className="text-center p-4 bg-vellum/45 border border-mist/15 rounded-2xl">
              <div className="text-2xl font-extrabold text-clay">
                {sessionResult.longestSilence}s
              </div>
              <div className="text-xs font-bold text-mist uppercase tracking-wide mt-1">Longest Pause</div>
              <div className="text-[10px] font-semibold text-ash/80 mt-1">Ideal: &lt; 4s</div>
            </div>
          </div>

          {/* Filler Word Breakdown */}
          {sessionResult.fillerWords.length > 0 && (
            <div className="mt-6 p-5 bg-clay/5 border border-clay/15 rounded-2xl">
              <div className="flex items-center gap-2.5 mb-3">
                <AlertTriangle className="w-4.5 h-4.5 text-clay" />
                <h4 className="font-bold font-serif text-void">Filler Words Detected</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {sessionResult.fillerWords.map((fw, i) => (
                  <span key={i} className="bg-clay/10 border border-clay/10 text-clay px-3.5 py-1 rounded-full text-xs font-bold">
                    "{fw.word}" &times; {fw.count}
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
            className="bg-vellum/35 border border-mist/20 rounded-3xl p-6 sm:p-8 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5">
              <Award className="w-5.5 h-5.5 text-clay" />
              <h3 className="text-lg font-bold font-serif text-void tracking-tight">Key Strengths</h3>
            </div>
            <ul className="space-y-3.5">
              {sessionResult.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-clay rounded-full mt-2 flex-shrink-0" />
                  <span className="text-sm text-ash/90 leading-relaxed">{strength}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-vellum/35 border border-mist/20 rounded-3xl p-6 sm:p-8 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-5.5 h-5.5 text-clay" />
              <h3 className="text-lg font-bold font-serif text-void tracking-tight">Focus & Growth Areas</h3>
            </div>
            <ul className="space-y-3.5">
              {sessionResult.improvements.map((improvement, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-clay-pale rounded-full mt-2 flex-shrink-0" />
                  <span className="text-sm text-ash/90 leading-relaxed">{improvement}</span>
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
            className="bg-vellum/35 border border-mist/20 rounded-3xl p-6 sm:p-8 shadow-sm mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-clay" />
              <h3 className="text-lg font-bold font-serif text-void tracking-tight">Session Transcript</h3>
            </div>
            <div className="max-h-48 overflow-y-auto p-4 bg-vellum/50 border border-mist/20 rounded-xl">
              <p className="text-sm text-ash leading-relaxed whitespace-pre-wrap">
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
            className="flex items-center gap-2 px-6 py-3.5 bg-clay text-parchment rounded-xl hover:bg-clay/90 active:scale-95 transition-all font-bold shadow-md shadow-clay/15"
          >
            <RotateCcw className="w-5 h-5" />
            Practice Again
          </button>
          
          <button
            onClick={onClose}
            className="px-6 py-3.5 bg-vellum border border-mist/25 text-ash hover:bg-vellum/80 active:scale-95 transition-all font-bold rounded-xl"
          >
            Save & Continue
          </button>
        </motion.div>
      </div>
    </div>
  );
}