import { useState, useEffect } from 'react';
import { MessageCircle, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type InterviewSession = {
  id: string;
  type: 'quick' | 'full' | 'technical' | 'behavioral';
  questions: string[];
  currentQuestion: number;
  startTime?: Date;
};

type Props = {
  session: InterviewSession;
  userTranscript: string;
  onQuestionChange: (questionIndex: number) => void;
  onFinishInterview: () => void;
};

export function AIInterviewer({ session, userTranscript, onQuestionChange, onFinishInterview }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState(session.currentQuestion);
  const [isThinking, setIsThinking] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [interviewerPersonality] = useState({
    name: 'Alex Chen',
    role: 'Senior Hiring Manager',
    company: 'TechCorp',
    avatar: '👨‍💼'
  });

  // Sync with parent's currentQuestion (for skip/repeat from SessionControls)
  useEffect(() => {
    if (session.currentQuestion !== currentQuestion && session.currentQuestion >= 0) {
      setCurrentQuestion(session.currentQuestion);
    }
  }, [session.currentQuestion, currentQuestion]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (session.startTime) {
        const elapsed = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session.startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLastQuestion = currentQuestion >= session.questions.length - 1;

  const nextQuestion = () => {
    if (!isLastQuestion) {
      setIsThinking(true);
      setTimeout(() => {
        const nextIndex = currentQuestion + 1;
        setCurrentQuestion(nextIndex);
        onQuestionChange(nextIndex);
        setIsThinking(false);
      }, 1500);
    }
  };

  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);

  useEffect(() => {
    // Check if Ollama is available
    import('../../services/ollamaService').then(({ OllamaService }) => {
      OllamaService.checkAvailability().then(status => {
        setOllamaAvailable(status.available);
      });
    });
  }, []);

  const handleGenerateFollowUp = async () => {
    setIsGeneratingFollowUp(true);
    setFollowUpQuestion(null);
    try {
      const { OllamaService } = await import('../../services/ollamaService');
      const question = await OllamaService.generateFollowUp(
        session.questions[currentQuestion], 
        userTranscript
      );
      setFollowUpQuestion(question);
    } catch {
      console.error('Failed to generate follow-up');
      // Smart fallback based on question type
      const fallbacks = getSmartFallback(session.questions[currentQuestion]);
      setFollowUpQuestion(fallbacks);
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  const getSmartFallback = (question: string): string => {
    const q = question.toLowerCase();
    if (q.includes('tell me about yourself')) return "What specific experience makes you the best fit for this role?";
    if (q.includes('strength')) return "Can you give me a concrete example where that strength made a measurable impact?";
    if (q.includes('weakness') || q.includes('failed')) return "What steps have you taken since then to improve?";
    if (q.includes('team')) return "What was your specific role and contribution within that team?";
    if (q.includes('challenge') || q.includes('difficult')) return "How did you measure the success of your approach?";
    if (q.includes('5 years') || q.includes('future')) return "How does this role align with those long-term goals?";
    if (q.includes('leadership')) return "How did you handle disagreement within the team?";
    if (q.includes('stress') || q.includes('pressure')) return "Can you walk me through a specific high-pressure situation?";
    
    const generic = [
      "Can you give me a specific example of that?",
      "What was the measurable outcome?",
      "How did your team or stakeholders react?",
      "What would you do differently if you faced this again?",
      "What was the biggest lesson you took from that experience?",
    ];
    return generic[Math.floor(Math.random() * generic.length)];
  };

  return (
    <div className="h-full flex flex-col">
      {/* Interviewer Profile Card */}
      <div className="relative group mb-8">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-500" />
        <div className="relative bg-black/40 border border-white/10 rounded-2xl p-5 backdrop-blur-xl flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-3xl shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
              <span className="relative z-10">{interviewerPersonality.avatar}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-[#0a0a0c] rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-white tracking-tight">{interviewerPersonality.name}</h3>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-widest">AI Agent</span>
            </div>
            <p className="text-gray-400 text-sm font-medium">{interviewerPersonality.role} @ {interviewerPersonality.company}</p>
          </div>
        </div>
      </div>

      {/* Session Info */}
      <div className="flex items-center justify-between mb-6 text-sm text-gray-300">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>{formatTime(elapsedTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          <span>Question {currentQuestion + 1} of {session.questions.length}</span>
        </div>
      </div>

      {/* Question Display */}
      <div className="flex-1 bg-gray-800 rounded-lg p-6">
        <AnimatePresence mode="wait">
          {isThinking ? (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-full"
            >
              <div className="text-center">
                <div className="animate-pulse text-4xl mb-4">🤔</div>
                <p className="text-gray-300">Thinking of the next question...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`question-${currentQuestion}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full flex flex-col"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-blue-500 font-mono text-sm tracking-widest uppercase">Question {currentQuestion + 1}</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-blue-500/50 to-transparent" />
                </div>
                
                <h4 className="text-3xl font-bold text-white leading-tight mb-8">
                  {session.questions[currentQuestion]}
                </h4>

                <AnimatePresence>
                  {followUpQuestion && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-6 p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg"
                    >
                      <h5 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Follow-up:
                      </h5>
                      <p className="text-lg text-blue-100">"{followUpQuestion}"</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                {isLastQuestion ? (
                  <button
                    onClick={onFinishInterview}
                    className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finish Interview
                  </button>
                ) : (
                  <button
                    onClick={nextQuestion}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Next Question
                  </button>
                )}
                <button
                  onClick={handleGenerateFollowUp}
                  disabled={isGeneratingFollowUp}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isGeneratingFollowUp ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Generating...</>
                  ) : (
                    <>Ask Follow-up {ollamaAvailable && <span className="text-xs bg-blue-500 px-1.5 py-0.5 rounded text-white font-bold ml-1">AI</span>}</>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Progress</span>
          <span>{Math.round(((currentQuestion + 1) / session.questions.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / session.questions.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}