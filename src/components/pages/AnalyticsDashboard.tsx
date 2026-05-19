import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Calendar, Target, Award, BarChart3, PieChart, LineChart } from 'lucide-react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie } from 'recharts';
import { SessionStorageService, UserStats, SkillProgress, Achievement } from '../../services/sessionStorageService';
import { User } from '../../types';

type Props = {
  user: User;
  onBack: () => void;
};

export function AnalyticsDashboard({ onBack }: Props) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [loading, setLoading] = useState(true);

  // Real data from IndexedDB
  const [stats, setStats] = useState<UserStats | null>(null);
  const [progressData, setProgressData] = useState<{ date: string; score: number; sessions: number }[]>([]);
  const [skillBreakdown, setSkillBreakdown] = useState<SkillProgress[]>([]);
  const [interviewTypes, setInterviewTypes] = useState<{ name: string; value: number; color: string }[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const storage = new SessionStorageService();
      await storage.initialize();

      const [userStats, progress, skills, types, achievs] = await Promise.all([
        storage.getUserStats(),
        storage.getProgressChartData(),
        storage.getSkillProgress(),
        storage.getInterviewTypeDistribution(),
        storage.getAchievements()
      ]);

      setStats(userStats);
      setProgressData(progress);
      setSkillBreakdown(skills);
      setInterviewTypes(types);
      setAchievements(achievs);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Harmonized warm editorial colors for distribution slices
  const terroirChartColors = [
    '#BE5F3C', // var(--color-clay)
    '#E5A88A', // var(--color-clay-pale)
    '#4A4640', // var(--color-ash)
    '#9A9188', // var(--color-mist)
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-parchment p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clay mx-auto mb-4"></div>
          <p className="text-ash font-medium">Loading analytics telemetry...</p>
        </div>
      </div>
    );
  }

  const hasData = (stats?.totalSessions ?? 0) > 0;

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

  return (
    <div className="min-h-screen bg-parchment p-6 sm:p-10 text-left font-sans text-ash">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-ash hover:text-void transition-colors font-bold self-start sm:self-auto"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          
          <h1 className="text-4xl font-bold font-serif text-void tracking-tight sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            Performance Analytics
          </h1>
          
          <div className="flex gap-1.5 bg-vellum/40 p-1 rounded-xl border border-mist/20 self-end sm:self-auto shadow-sm">
            {(['week', 'month', 'quarter'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  timeRange === range
                    ? 'bg-clay text-parchment shadow-sm'
                    : 'text-ash hover:text-void hover:bg-vellum/50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {!hasData ? (
          /* Empty State */
          <div className="bg-vellum/35 border border-mist/20 rounded-3xl p-16 shadow-sm text-center max-w-xl mx-auto">
            <div className="w-16 h-16 bg-clay/10 rounded-full border border-clay/10 flex items-center justify-center mx-auto mb-6">
              <BarChart3 className="w-8 h-8 text-clay" />
            </div>
            <h2 className="text-2xl font-bold font-serif text-void mb-3">No Analytics Record Yet</h2>
            <p className="text-ash/90 text-sm mb-8 leading-relaxed max-w-md mx-auto">
              Complete your first interview practice session to generate real performance telemetry, charts, and unlocked milestones.
            </p>
            <button
              onClick={onBack}
              className="bg-clay text-parchment px-6 py-3 rounded-xl hover:bg-clay/90 active:scale-95 transition-all font-bold shadow-md shadow-clay/15"
            >
              Start Practice Session
            </button>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {[
                { label: 'Total Sessions', value: stats?.totalSessions ?? 0, icon: BarChart3 },
                { label: 'Practice Time', value: `${stats?.totalPracticeMinutes ?? 0}m`, icon: Calendar },
                { 
                  label: 'Average Score', 
                  value: `${stats?.averageScore ?? 0}%`, 
                  icon: TrendingUp,
                  valueColor: stats?.averageScore ? getScoreColor(stats.averageScore) : 'text-void',
                  trend: (stats?.improvement ?? 0) !== 0 ? {
                    value: `${(stats?.improvement ?? 0) > 0 ? '+' : ''}${stats?.improvement}%`,
                    isUp: (stats?.improvement ?? 0) >= 0
                  } : undefined
                },
                { label: 'Best Streak', value: `${stats?.bestStreak ?? 0} days`, icon: Target }
              ].map((stat, i) => (
                <div key={i} className="bg-vellum/35 backdrop-blur-sm p-6 rounded-2xl border border-mist/20 shadow-sm hover:shadow-md hover:border-clay/20 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-mist uppercase tracking-wider mb-1">{stat.label}</p>
                      <p className={`text-3xl font-extrabold ${stat.valueColor || 'text-void'}`}>{stat.value}</p>
                      {stat.trend && (
                        <p className={`text-xs font-bold mt-1 ${stat.trend.isUp ? 'text-clay' : 'text-mist'}`}>
                          {stat.trend.value} trend
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-clay/10 border border-clay/10 rounded-xl flex items-center justify-center">
                      <stat.icon className="h-6 w-6 text-clay" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              {/* Progress Over Time */}
              <div className="bg-vellum/35 border border-mist/20 rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <LineChart className="w-5 h-5 text-clay" />
                  <h3 className="text-xl font-bold font-serif text-void tracking-tight">Score Progress</h3>
                </div>
                {progressData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={progressData}>
                      <CartesianGrid stroke="#9A9188" strokeDasharray="3 3" opacity={0.15} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#4A4640" 
                        tick={{ fontSize: 10, fontWeight: 600 }}
                        tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} 
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        stroke="#4A4640" 
                        tick={{ fontSize: 10, fontWeight: 600 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#E1DAD0', 
                          border: '1px solid #9A9188', 
                          borderRadius: '12px',
                          color: '#0D0B09',
                          fontFamily: 'Outfit, sans-serif'
                        }}
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        formatter={(value: number, name: string) => [
                          name === 'score' ? `${value}%` : value,
                          name === 'score' ? 'Avg Score' : 'Sessions'
                        ]}
                      />
                      <Line type="monotone" dataKey="score" stroke="#BE5F3C" strokeWidth={3} dot={{ fill: '#BE5F3C', strokeWidth: 1 }} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-mist font-medium">
                    <p>Complete more sessions to see your progress trend</p>
                  </div>
                )}
              </div>

              {/* Interview Types Distribution */}
              <div className="bg-vellum/35 border border-mist/20 rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <PieChart className="w-5 h-5 text-clay" />
                  <h3 className="text-xl font-bold font-serif text-void tracking-tight">Interview Types</h3>
                </div>
                {interviewTypes.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={interviewTypes}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {interviewTypes.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={terroirChartColors[index % terroirChartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value}%`, 'Percentage']} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-mist font-medium">
                    <p>Try different interview types to see distribution</p>
                  </div>
                )}
              </div>
            </div>

            {/* Skills Breakdown */}
            <div className="bg-vellum/35 border border-mist/20 rounded-3xl p-6 sm:p-8 shadow-sm mb-8">
              <h3 className="text-xl font-bold font-serif text-void mb-6 tracking-tight">Skills Breakdown</h3>
              <div className="space-y-5">
                {skillBreakdown.map((skill, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-ash">{skill.name}</span>
                        <div className="flex items-center gap-2">
                          {skill.trend === 'up' && <span className="text-clay text-sm font-extrabold">↑</span>}
                          {skill.trend === 'down' && <span className="text-mist text-sm font-extrabold">↓</span>}
                          <span className={`font-extrabold ${skill.score > 0 ? getScoreColor(skill.score) : 'text-mist'}`}>
                            {skill.score > 0 ? `${skill.score}%` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-vellum/60 rounded-full h-2.5 border border-mist/10">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            skill.score >= 80 ? 'bg-clay' :
                            skill.score >= 60 ? 'bg-clay-pale' :
                            skill.score > 0 ? 'bg-mist' : 'bg-vellum/20'
                          }`}
                          style={{ width: `${skill.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievements */}
            <div className="bg-vellum/35 border border-mist/20 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <Award className="w-5 h-5 text-clay" />
                <h3 className="text-xl font-bold font-serif text-void tracking-tight">Unlocked Milestones</h3>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 ${
                      achievement.earned
                        ? 'border-clay/20 bg-clay/5 shadow-sm'
                        : 'border-mist/20 bg-vellum/10'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-void">{achievement.title}</h4>
                      {achievement.earned ? (
                        <Award className="w-5.5 h-5.5 text-clay" />
                      ) : (
                        <div className="w-5.5 h-5.5 border-2 border-mist/40 rounded-full flex items-center justify-center" />
                      )}
                    </div>
                    <p className="text-xs text-ash/90 mb-4 leading-relaxed">{achievement.description}</p>
                    {achievement.earned ? (
                      <p className="text-[10px] font-bold text-clay uppercase tracking-wider">
                        Earned {new Date(achievement.date!).toLocaleDateString()}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold text-mist uppercase tracking-wider">
                          <span>Progress</span>
                          <span>{achievement.progress}%</span>
                        </div>
                        <div className="w-full bg-vellum/60 rounded-full h-1.5 border border-mist/10">
                          <div
                            className="bg-clay-pale h-full rounded-full"
                            style={{ width: `${achievement.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}