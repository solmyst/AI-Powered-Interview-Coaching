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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  const hasData = (stats?.totalSessions ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
          <div className="flex gap-2">
            {(['week', 'month', 'quarter'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {!hasData ? (
          /* Empty State */
          <div className="bg-white rounded-xl p-12 shadow-lg text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Analytics Yet</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Complete your first interview practice session to see real performance analytics, trends, and achievements here.
            </p>
            <button
              onClick={onBack}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Your First Session
            </button>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Sessions</p>
                    <p className="text-2xl font-bold text-gray-800">{stats?.totalSessions ?? 0}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Practice Time</p>
                    <p className="text-2xl font-bold text-gray-800">{stats?.totalPracticeMinutes ?? 0}m</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Calendar className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Average Score</p>
                    <p className="text-2xl font-bold text-gray-800">{stats?.averageScore ?? 0}%</p>
                    {(stats?.improvement ?? 0) !== 0 && (
                      <p className={`text-sm ${(stats?.improvement ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(stats?.improvement ?? 0) > 0 ? '+' : ''}{stats?.improvement}% trend
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Best Streak</p>
                    <p className="text-2xl font-bold text-gray-800">{stats?.bestStreak ?? 0} days</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Target className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              {/* Progress Over Time */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-6">
                  <LineChart className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-800">Score Progress</h3>
                </div>
                {progressData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip 
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        formatter={(value: number, name: string) => [
                          name === 'score' ? `${value}%` : value,
                          name === 'score' ? 'Avg Score' : 'Sessions'
                        ]}
                      />
                      <Line type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6' }} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    <p>Complete more sessions to see your progress trend</p>
                  </div>
                )}
              </div>

              {/* Interview Types Distribution */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-6">
                  <PieChart className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-bold text-gray-800">Interview Types</h3>
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
                        {interviewTypes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value}%`, 'Percentage']} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    <p>Try different interview types to see distribution</p>
                  </div>
                )}
              </div>
            </div>

            {/* Skills Breakdown */}
            <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Skills Breakdown</h3>
              <div className="space-y-4">
                {skillBreakdown.map((skill, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{skill.name}</span>
                        <div className="flex items-center gap-2">
                          {skill.trend === 'up' && <span className="text-green-600 text-sm font-medium">↑</span>}
                          {skill.trend === 'down' && <span className="text-red-600 text-sm font-medium">↓</span>}
                          <span className="font-bold text-gray-800">{skill.score > 0 ? `${skill.score}%` : '—'}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            skill.score >= 80 ? 'bg-green-500' :
                            skill.score >= 60 ? 'bg-yellow-500' :
                            skill.score > 0 ? 'bg-red-500' : 'bg-gray-300'
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
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-6">
                <Award className="w-5 h-5 text-yellow-600" />
                <h3 className="text-lg font-bold text-gray-800">Achievements</h3>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`p-4 rounded-lg border-2 ${
                      achievement.earned
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-800">{achievement.title}</h4>
                      {achievement.earned ? (
                        <Award className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                    {achievement.earned ? (
                      <p className="text-xs text-green-600">
                        Earned on {new Date(achievement.date!).toLocaleDateString()}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Progress: {achievement.progress}%</p>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-blue-600 h-1 rounded-full"
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