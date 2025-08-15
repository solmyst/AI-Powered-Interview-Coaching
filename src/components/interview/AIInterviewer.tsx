import React, { useState, useEffect } from 'react';
import { Clock, MessageCircle } from 'lucide-react';
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
  onQuestionChange: (questionIndex: number) => void;
};

export function AIInterviewer({ session, onQuestionChange }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [interviewerPersonality] = useState({
    name: 'Alex Chen',
    role: 'Senior Hiring Manager',
    company: 'TechCorp',
    avatar: '👨‍💼'
  });

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

  const nextQuestion = () => {
    if (currentQuestion < session.questions.length - 1) {
      setIsThinking(true);
      setTimeout(() => {
        const nextIndex = currentQuestion + 1;
        setCurrentQuestion(nextIndex);
        onQuestionChange(nextIndex);
        setIsThinking(false);
      }, 2000);
    }
  };

  const generateFollowUp = () => {
    const followUps = [
      "Can you give me a specific example?",
      "How did that make you feel?",
      "What would you do differently next time?",
      "How did your team react to that?",
      "What was the outcome?",
      "How did you measure success?",
      "What challenges did you face?",
      "How long did that take?"
    ];
    return followUps[Math.floor(Math.random() * followUps.length)];
  };

  return (
    <div className="h-full flex flex-col">
      {/* Interviewer Header */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl">
            {interviewerPersonality.avatar}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{interviewerPersonality.name}</h3>
            <p className="text-gray-300 text-sm">{interviewerPersonality.role}</p>
            <p className="text-gray-400 text-xs">{interviewerPersonality.company}</p>
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
                <h4 className="text-lg font-medium text-white mb-4">
                  Question {currentQuestion + 1}:
                </h4>
                <p className="text-xl text-gray-100 leading-relaxed mb-6">
                  {session.questions[currentQuestion]}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={nextQuestion}
                  disabled={currentQuestion >= session.questions.length - 1}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next Question
                </button>
                <button
                  onClick={() => {
                    const followUp = generateFollowUp();
                    // In a real app, this would add the follow-up to the conversation
                    alert(`Follow-up: ${followUp}`);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Follow-up
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