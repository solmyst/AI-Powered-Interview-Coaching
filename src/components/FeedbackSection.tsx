import React, { useState } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, Star, Send } from 'lucide-react';

interface FeedbackSectionProps {
  tripId: string;
}

const FeedbackSection: React.FC<FeedbackSectionProps> = ({ tripId }) => {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const commonIssues = [
    'Toll cost incorrect',
    'Fuel price outdated',
    'Route not optimal',
    'Food cost estimate off',
    'Travel time wrong',
    'Missing tolls'
  ];

  const handleIssueToggle = (issue: string) => {
    setSelectedIssues(prev => 
      prev.includes(issue) 
        ? prev.filter(i => i !== issue)
        : [...prev, issue]
    );
  };

  const handleSubmit = () => {
    // In a real app, this would send feedback to the backend
    console.log('Feedback submitted:', {
      tripId,
      feedback,
      rating,
      comments,
      issues: selectedIssues
    });
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  if (isSubmitted) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ThumbsUp className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Thank You!</h3>
          <p className="text-gray-600">Your feedback helps us improve Trip Helper for everyone.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <MessageSquare className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">How was your trip planning experience?</h2>
      </div>

      {/* Quick Feedback Buttons */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Were our estimates accurate?</p>
        <div className="flex space-x-4">
          <button
            onClick={() => setFeedback('positive')}
            className={`flex items-center space-x-2 px-4 py-3 rounded-lg border transition-all ${
              feedback === 'positive'
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ThumbsUp className="w-5 h-5" />
            <span>Yes, very accurate</span>
          </button>
          <button
            onClick={() => setFeedback('negative')}
            className={`flex items-center space-x-2 px-4 py-3 rounded-lg border transition-all ${
              feedback === 'negative'
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ThumbsDown className="w-5 h-5" />
            <span>Needs improvement</span>
          </button>
        </div>
      </div>

      {/* Rating */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Rate your overall experience</p>
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`p-1 transition-colors ${
                star <= rating ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
              }`}
            >
              <Star className="w-6 h-6 fill-current" />
            </button>
          ))}
        </div>
      </div>

      {/* Issues (if negative feedback) */}
      {feedback === 'negative' && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">What issues did you encounter?</p>
          <div className="grid md:grid-cols-2 gap-2">
            {commonIssues.map((issue) => (
              <button
                key={issue}
                onClick={() => handleIssueToggle(issue)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedIssues.includes(issue)
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {issue}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Comments (Optional)
        </label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Share your thoughts or suggestions..."
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!feedback}
        className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all ${
          feedback
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        <Send className="w-5 h-5" />
        <span>Submit Feedback</span>
      </button>
    </div>
  );
};

export default FeedbackSection;