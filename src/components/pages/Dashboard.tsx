import { useState, useEffect } from 'react';
import { 
  Play,
  TrendingUp,
  Award,
  Target,
  Calendar,
  BarChart3,
  CheckCircle,
  Video,
  Brain,
  Users
} from 'lucide-react';
import { Page, User } from '../../types';
import { SessionStorageService, SessionRecord, UserStats } from '../../services/sessionStorageService';

interface DashboardProps {
  user: User;
  onNavigate: (page: Page) => void;
  onStartInterview?: (type: string) => void;
}

export function Dashboard({ user, onNavigate, onStartInterview }: DashboardProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([]);
  const [skillProgress, setSkillProgress] = useState<{ name: string; score: number; trend: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const storage = new SessionStorageService();
      await storage.initialize();

      const [userStats, recent, skills] = await Promise.all([
        storage.getUserStats(),
        storage.getRecentSessions(3),
        storage.getSkillProgress()
      ]);

      setStats(userStats);
      setRecentSessions(recent);
      setSkillProgress(skills);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const practiceOptions = [
    {
      id: 'quick',
      title: 'Quick Practice',
      description: '5-10 min session with 5 questions',
      duration: '5-10 min',
      icon: Play,
      color: 'bg-green-100 text-green-600'
    },
    {
      id: 'full',
      title: 'Full Mock Interview',
      description: 'Complete 45-60 min simulation',
      duration: '45-60 min',
      icon: Video,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      id: 'technical',
      title: 'Technical Focus',
      description: 'Technical problem-solving questions',
      duration: '30 min',
      icon: Brain,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      id: 'behavioral',
      title: 'Behavioral',
      description: 'STAR method & soft skills practice',
      duration: '25 min',
      icon: Users,
      color: 'bg-orange-100 text-orange-600'
    }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your data...</p>
          </div>
        </div>
      </div>
    );
  }

  const displayStats = {
    totalSessions: stats?.totalSessions ?? 0,
    averageScore: stats?.averageScore ?? 0,
    improvement: stats?.improvement ?? 0,
    nextGoal: stats?.averageScore ? Math.min(100, stats.averageScore + 10) : 75,
    currentStreak: stats?.currentStreak ?? 0,
    totalPracticeMinutes: stats?.totalPracticeMinutes ?? 0
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user.name}!
        </h1>
        <p className="text-gray-600">
          {displayStats.totalSessions === 0 
            ? "Ready to start your interview preparation? Let's begin your first session."
            : "Ready to continue improving your interview skills?"
          }
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{displayStats.totalSessions}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Video className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Score</p>
              <p className={`text-2xl font-bold ${displayStats.averageScore > 0 ? getScoreColor(displayStats.averageScore) : 'text-gray-400'}`}>
                {displayStats.averageScore > 0 ? `${displayStats.averageScore}%` : '—'}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Improvement</p>
              <p className={`text-2xl font-bold ${displayStats.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {displayStats.totalSessions >= 2 ? `${displayStats.improvement > 0 ? '+' : ''}${displayStats.improvement}%` : '—'}
              </p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                {displayStats.currentStreak > 0 ? 'Streak' : 'Goal'}
              </p>
              <p className="text-2xl font-bold text-purple-600">
                {displayStats.currentStreak > 0 ? `${displayStats.currentStreak}d` : `${displayStats.nextGoal}%`}
              </p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Target className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Practice Options - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">Start Practicing</h2>
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {practiceOptions.map((option, index) => (
                <div 
                  key={index}
                  className="p-5 border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                  onClick={() => onStartInterview ? onStartInterview(option.id) : onNavigate('interview')}
                >
                  <div className={`w-10 h-10 ${option.color} rounded-lg flex items-center justify-center mb-3`}>
                    <option.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{option.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{option.description}</p>
                  <span className="text-xs text-blue-600 font-medium">{option.duration}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Recent Sessions</h2>
            
            {recentSessions.length > 0 ? (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-12 h-12 ${getScoreBg(session.overallScore)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <span className={`text-sm font-bold ${getScoreColor(session.overallScore)}`}>
                        {session.overallScore}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 capitalize">{session.type} Interview</h4>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>{new Date(session.date).toLocaleDateString()}</span>
                        <span>{Math.round(session.duration / 60)} min</span>
                        <span>{session.totalWords} words</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Video className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No sessions yet</p>
                <p className="text-sm mt-1">Start your first practice session above!</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Skill Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Skill Progress</h3>
            
            {skillProgress.some(s => s.score > 0) ? (
              <div className="space-y-4">
                {skillProgress.map((skill) => (
                  <div key={skill.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{skill.name}</span>
                      <span className={`text-sm font-bold ${skill.score > 0 ? getScoreColor(skill.score) : 'text-gray-400'}`}>
                        {skill.score > 0 ? `${skill.score}%` : '—'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          skill.score >= 80 ? 'bg-green-500' : 
                          skill.score >= 60 ? 'bg-yellow-500' : 
                          skill.score > 0 ? 'bg-red-500' : 'bg-gray-300'
                        }`}
                        style={{ width: `${skill.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                Complete a session to see progress.
              </p>
            )}
          </div>

          {/* Tips */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Tips</h3>
            <div className="space-y-3">
              {[
                { tip: 'Use the STAR method', desc: 'Situation → Task → Action → Result' },
                { tip: 'Maintain eye contact', desc: 'Look at the camera, not the screen' },
                { tip: 'Pause before answering', desc: 'Take a breath to collect your thoughts' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.tip}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Achievement Card */}
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <Award className="h-7 w-7 text-yellow-300" />
              <div>
                <h3 className="font-bold">
                  {displayStats.totalSessions === 0 ? 'Get Started!' : 'Keep Going!'}
                </h3>
                <p className="text-blue-100 text-sm">
                  {displayStats.totalSessions === 0 
                    ? 'Your AI coach is ready'
                    : `${displayStats.totalSessions} sessions done`
                  }
                </p>
              </div>
            </div>
            <p className="text-blue-100 text-sm">
              {displayStats.totalSessions === 0 
                ? "Start practicing to get real AI feedback on eye contact, speech, and body language."
                : `${displayStats.totalPracticeMinutes} minutes of practice. Every session makes you better!`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}