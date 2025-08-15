import React from 'react';
import { 
  Play,
  TrendingUp,
  Clock,
  Award,
  Target,
  ArrowRight,
  Calendar,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Star,
  Video,
  Brain,
  Users
} from 'lucide-react';

interface DashboardProps {
  user: {
    id: string;
    name: string;
    email: string;
    subscription: 'free' | 'premium' | 'professional';
    avatar?: string;
  };
  onNavigate: (page: string) => void;
}

export function Dashboard({ user, onNavigate }: DashboardProps) {
  // Mock data - in real app this would come from API
  const stats = {
    totalSessions: user.subscription === 'free' ? 2 : 47,
    averageScore: 78,
    improvement: 23,
    nextGoal: 85,
    sessionsThisMonth: user.subscription === 'free' ? 2 : 12,
    maxSessions: user.subscription === 'free' ? 3 : 999,
  };

  const recentSessions = [
    {
      id: 1,
      type: 'Technical Interview',
      date: '2025-01-02',
      score: 82,
      duration: '45 min',
      improvements: ['Eye contact', 'Speaking pace']
    },
    {
      id: 2,
      type: 'Behavioral Interview',
      date: '2024-12-30',
      score: 76,
      duration: '30 min',
      improvements: ['Answer structure', 'Confidence']
    },
    {
      id: 3,
      type: 'Industry Focus: Tech',
      date: '2024-12-28',
      score: 74,
      duration: '60 min',
      improvements: ['Technical depth', 'Communication']
    }
  ];

  const skillAreas = [
    { name: 'Communication', score: 85, trend: 'up' },
    { name: 'Body Language', score: 72, trend: 'up' },
    { name: 'Technical Knowledge', score: 78, trend: 'stable' },
    { name: 'Confidence', score: 81, trend: 'up' },
  ];

  const practiceOptions = [
    {
      title: 'Quick Practice',
      description: '10-15 minute session with basic questions',
      duration: '10-15 min',
      difficulty: 'Beginner',
      icon: Play,
      color: 'bg-green-100 text-green-600'
    },
    {
      title: 'Full Mock Interview',
      description: 'Complete 45-60 minute interview simulation',
      duration: '45-60 min',
      difficulty: 'Advanced',
      icon: Video,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Technical Focus',
      description: 'Coding and technical problem-solving practice',
      duration: '30-45 min',
      difficulty: 'Expert',
      icon: Brain,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Panel Interview',
      description: 'Practice with multiple AI interviewers',
      duration: '45 min',
      difficulty: 'Advanced',
      icon: Users,
      color: 'bg-orange-100 text-orange-600',
      premium: true
    }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 70) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user.name}!
        </h1>
        <p className="text-gray-600">
          Ready to continue improving your interview skills? Let's practice today.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSessions}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Video className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Score</p>
              <p className={`text-2xl font-bold ${getScoreColor(stats.averageScore)}`}>
                {stats.averageScore}%
              </p>
            </div>
            <div className={`w-12 h-12 ${getScoreBg(stats.averageScore)} rounded-lg flex items-center justify-center`}>
              <BarChart3 className={`h-6 w-6 ${getScoreColor(stats.averageScore)}`} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Improvement</p>
              <p className="text-2xl font-bold text-green-600">+{stats.improvement}%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Next Goal</p>
              <p className="text-2xl font-bold text-purple-600">{stats.nextGoal}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Usage Limit for Free Users */}
      {user.subscription === 'free' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-900 mb-1">Free Plan Limit</h3>
              <p className="text-sm text-amber-700 mb-3">
                You've used {stats.sessionsThisMonth} of {stats.maxSessions} free sessions this month.
                {stats.sessionsThisMonth >= stats.maxSessions && " Upgrade to continue practicing!"}
              </p>
              <div className="flex items-center space-x-4">
                <div className="flex-1 bg-amber-200 rounded-full h-2">
                  <div 
                    className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(stats.sessionsThisMonth / stats.maxSessions) * 100}%` }}
                  ></div>
                </div>
                <button 
                  onClick={() => onNavigate('pricing')}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Practice Options */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Start Practicing</h2>
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {practiceOptions.map((option, index) => (
                <div key={index} className="group relative">
                  <div 
                    className={`p-6 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-300 cursor-pointer ${
                      option.premium && user.subscription === 'free' 
                        ? 'opacity-60' 
                        : 'hover:border-blue-300'
                    }`}
                    onClick={() => {
                      if (user.subscription === 'free' && stats.sessionsThisMonth >= stats.maxSessions) {
                        onNavigate('pricing');
                      } else if (!option.premium || user.subscription !== 'free') {
                        onNavigate('interview');
                      }
                    }}
                  >
                    <div className={`w-12 h-12 ${option.color} rounded-lg flex items-center justify-center mb-4`}>
                      <option.icon className="h-6 w-6" />
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                      <span>{option.title}</span>
                      {option.premium && user.subscription === 'free' && (
                        <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
                          Premium
                        </span>
                      )}
                    </h3>
                    
                    <p className="text-sm text-gray-600 mb-4">{option.description}</p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{option.duration}</span>
                      <span>{option.difficulty}</span>
                    </div>
                  </div>
                  
                  {option.premium && user.subscription === 'free' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                      <button 
                        onClick={() => onNavigate('pricing')}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        Upgrade to Access
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Sessions</h2>
            
            {recentSessions.length > 0 ? (
              <div className="space-y-4">
                {recentSessions.slice(0, 3).map((session) => (
                  <div key={session.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-12 h-12 ${getScoreBg(session.score)} rounded-lg flex items-center justify-center`}>
                      <span className={`font-bold ${getScoreColor(session.score)}`}>
                        {session.score}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{session.type}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span>{session.date}</span>
                        <span>{session.duration}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">Areas to improve:</div>
                        <div className="text-xs text-gray-500">
                          {session.improvements.join(', ')}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No practice sessions yet. Start your first interview practice!</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Skill Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Skill Progress</h3>
            
            <div className="space-y-4">
              {skillAreas.map((skill) => (
                <div key={skill.name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{skill.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-bold ${getScoreColor(skill.score)}`}>
                        {skill.score}%
                      </span>
                      {skill.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        skill.score >= 80 ? 'bg-green-500' : 
                        skill.score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${skill.score}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Tips */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Today's Tips</h3>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Practice the STAR method</p>
                  <p className="text-xs text-gray-600">Structure your answers: Situation, Task, Action, Result</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Maintain eye contact</p>
                  <p className="text-xs text-gray-600">Look directly at the camera, not the screen</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Speak clearly and pause</p>
                  <p className="text-xs text-gray-600">Take time to think before answering questions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Achievement */}
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center space-x-3 mb-4">
              <Award className="h-8 w-8 text-yellow-400" />
              <div>
                <h3 className="font-bold">Latest Achievement</h3>
                <p className="text-purple-100 text-sm">Consistency Champion</p>
              </div>
            </div>
            <p className="text-purple-100 text-sm">
              You've practiced 3 days in a row! Keep up the great work to improve your interview skills.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}