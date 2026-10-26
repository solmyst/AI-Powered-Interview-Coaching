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
      color: 'bg-clay/10 text-clay border-clay/10'
    },
    {
      id: 'full',
      title: 'Full Mock Interview',
      description: 'Complete 45-60 min simulation',
      duration: '45-60 min',
      icon: Video,
      color: 'bg-clay/10 text-clay border-clay/10'
    },
    {
      id: 'technical',
      title: 'Technical Focus',
      description: 'Technical problem-solving questions',
      duration: '30 min',
      icon: Brain,
      color: 'bg-clay/10 text-clay border-clay/10'
    },
    {
      id: 'behavioral',
      title: 'Behavioral',
      description: 'STAR method & soft skills practice',
      duration: '25 min',
      icon: Users,
      color: 'bg-clay/10 text-clay border-clay/10'
    }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-clay font-bold';
    if (score >= 60) return 'text-ash font-semibold';
    return 'text-mist';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-clay/10 border border-clay/10';
    if (score >= 60) return 'bg-vellum border border-mist/20';
    return 'bg-vellum/45 border border-mist/10';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clay mx-auto mb-4"></div>
            <p className="text-mist font-medium">Loading your telemetry...</p>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10 text-left">
        <h1 className="text-4xl font-bold font-serif text-void mb-2 tracking-tight">
          Welcome back, {user.name}!
        </h1>
        <p className="text-ash/90 text-md font-medium">
          {displayStats.totalSessions === 0 
            ? "Ready to begin your interview preparation? Let's start your first local session."
            : "Ready to continue sharpening your communication skills?"
          }
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Sessions Played', value: displayStats.totalSessions, icon: Video },
          { 
            label: 'Avg Score', 
            value: displayStats.averageScore > 0 ? `${displayStats.averageScore}%` : '—', 
            icon: BarChart3,
            valueColor: displayStats.averageScore > 0 ? getScoreColor(displayStats.averageScore) : 'text-mist'
          },
          { 
            label: 'Improvement', 
            value: displayStats.totalSessions >= 2 ? `${displayStats.improvement > 0 ? '+' : ''}${displayStats.improvement}%` : '—', 
            icon: TrendingUp,
            valueColor: displayStats.improvement >= 0 ? 'text-clay font-bold' : 'text-mist'
          },
          { 
            label: displayStats.currentStreak > 0 ? 'Current Streak' : 'Target Goal', 
            value: displayStats.currentStreak > 0 ? `${displayStats.currentStreak}d` : `${displayStats.nextGoal}%`, 
            icon: Target,
            valueColor: 'text-clay font-bold'
          }
        ].map((stat, i) => (
          <div key={i} className="bg-vellum/35 backdrop-blur-sm p-6 rounded-2xl border border-mist/20 shadow-sm hover:shadow-md hover:border-clay/25 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs font-bold text-mist uppercase tracking-wider mb-1">{stat.label}</p>
                <p className={`text-3xl font-extrabold ${stat.valueColor || 'text-void'}`}>{stat.value}</p>
              </div>
              <div className="w-12 h-12 bg-clay/10 border border-clay/10 rounded-xl flex items-center justify-center">
                <stat.icon className="h-6 w-6 text-clay" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Columns (Start Practice & History) */}
        <div className="lg:col-span-2 space-y-8 text-left">
          {/* Start Practicing Block */}
          <div className="bg-vellum/35 backdrop-blur-sm rounded-3xl border border-mist/20 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold font-serif text-void tracking-tight">Start Practicing</h2>
              <Calendar className="h-5 w-5 text-mist" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {practiceOptions.map((option, index) => (
                <div 
                  key={index}
                  className="p-5 border border-mist/20 bg-vellum/30 hover:bg-vellum/50 rounded-2xl hover:shadow-md hover:border-clay/40 transition-all duration-300 cursor-pointer group"
                  onClick={() => onStartInterview ? onStartInterview(option.id) : onNavigate('interview')}
                >
                  <div className={`w-10 h-10 ${option.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                    <option.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-void text-lg mb-1">{option.title}</h3>
                  <p className="text-sm text-ash mb-3 leading-relaxed">{option.description}</p>
                  <span className="text-xs text-clay font-bold uppercase tracking-wider">{option.duration}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Sessions List */}
          <div className="bg-vellum/35 backdrop-blur-sm rounded-3xl border border-mist/20 p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-bold font-serif text-void mb-6 tracking-tight">Recent Sessions</h2>
            
            {recentSessions.length > 0 ? (
              <div className="space-y-4">
                {recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-4 p-4 bg-vellum/20 border border-mist/10 rounded-xl hover:bg-vellum/50 transition-all duration-300">
                    <div className={`w-14 h-14 ${getScoreBg(session.overallScore)} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <span className={`text-base font-bold ${getScoreColor(session.overallScore)}`}>
                        {session.overallScore}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-void text-md capitalize">{session.type} Interview</h4>
                      <div className="flex items-center gap-3 text-xs text-mist font-semibold mt-1">
                        <span>{new Date(session.date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{Math.round(session.duration / 60)} min</span>
                        <span>•</span>
                        <span>{session.totalWords} words</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-mist">
                <div className="w-16 h-16 bg-vellum/60 rounded-full flex items-center justify-center mx-auto mb-4 border border-mist/10">
                  <Video className="h-7 w-7 text-mist/60" />
                </div>
                <p className="font-bold text-void">No sessions recorded yet</p>
                <p className="text-sm mt-1">Choose a scenario above to start your first session!</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar (Skills & Tips & Achievements) */}
        <div className="space-y-8 text-left">
          {/* Skill Progress Dashboard */}
          <div className="bg-vellum/35 backdrop-blur-sm rounded-3xl border border-mist/20 p-6 sm:p-8 shadow-sm">
            <h3 className="text-xl font-bold font-serif text-void mb-6 tracking-tight">Skill Telemetry</h3>
            
            {skillProgress.some(s => s.score > 0) ? (
              <div className="space-y-5">
                {skillProgress.map((skill) => (
                  <div key={skill.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-ash">{skill.name}</span>
                      <span className={`text-sm font-extrabold ${skill.score > 0 ? getScoreColor(skill.score) : 'text-mist'}`}>
                        {skill.score > 0 ? `${skill.score}%` : '—'}
                      </span>
                    </div>
                    <div className="w-full bg-vellum/60 rounded-full h-2.5 border border-mist/10">
                      <div 
                        className="h-full rounded-full bg-clay transition-all duration-700 shadow-sm"
                        style={{ width: `${skill.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-mist text-center py-6 font-medium">
                Complete a session to populate visual skills chart.
              </p>
            )}
          </div>

          {/* Quick Tips */}
          <div className="bg-vellum/35 backdrop-blur-sm rounded-3xl border border-mist/20 p-6 sm:p-8 shadow-sm">
            <h3 className="text-xl font-bold font-serif text-void mb-6 tracking-tight">Coaching Tips</h3>
            <div className="space-y-5">
              {[
                { tip: 'STAR Structure', desc: 'Situation → Task → Action → Result outlines.' },
                { tip: 'Lens Awareness', desc: 'Look directly at the physical camera, not the display.' },
                { tip: 'Intentional Pauses', desc: 'Pause silently instead of using fillers like "um" or "like".' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-clay flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-void">{item.tip}</p>
                    <p className="text-xs text-ash mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
              
              {/* Customize AI Box */}
              <div 
                className="p-4 bg-vellum/60 hover:bg-vellum rounded-2xl border border-mist/20 cursor-pointer transition-all duration-300"
                onClick={() => onNavigate('settings')}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Brain className="h-4 w-4 text-clay" />
                  <p className="text-sm font-bold text-void">Configure Local AI</p>
                </div>
                <p className="text-xs text-ash leading-relaxed">
                  Switch providers, change Ollama models, or insert OpenAI keys in the
                  <span className="font-bold underline ml-1 text-clay">Settings</span>.
                </p>
              </div>
            </div>
          </div>

          {/* Premium Achievements Card (Luxurious Dark Contrast) */}
          <div className="bg-gradient-to-br from-void via-carbon to-void border border-clay-pale/15 rounded-3xl p-6 text-parchment shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-clay-pale/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-clay-pale/10 rounded-xl flex items-center justify-center border border-clay-pale/20">
                <Award className="h-6 w-6 text-clay-pale" />
              </div>
              <div className="text-left">
                <h3 className="font-serif font-bold text-lg text-parchment">
                  {displayStats.totalSessions === 0 ? 'Ready to Begin?' : 'Excellent Work!'}
                </h3>
                <p className="text-mist text-xs font-semibold">
                  {displayStats.totalSessions === 0 
                    ? 'AI Feedback is armed'
                    : `${displayStats.totalSessions} sessions logged`
                  }
                </p>
              </div>
            </div>
            
            <p className="text-mist text-xs leading-relaxed mb-1">
              {displayStats.totalSessions === 0 
                ? "Click any practice segment above to capture eye telemetry, fillers, and speaking pace scores locally."
                : `${displayStats.totalPracticeMinutes} minutes spent practicing. Keep up the high standard of preparation!`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}