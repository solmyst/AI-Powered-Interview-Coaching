import React, { useState } from 'react';
import { ArrowLeft, TrendingUp, Calendar, Target, Award, BarChart3, PieChart, LineChart } from 'lucide-react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie } from 'recharts';

type User = {
  id: string;
  name: string;
  email: string;
  subscription: 'free' | 'premium' | 'professional';
  avatar?: string;
};

type Props = {
  user: User;
  onBack: () => void;
};

export function AnalyticsDashboard({ onBack }: Props) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');

  // Mock data for demonstration
  const progressData = [
    { date: '2024-01-01', score: 65, sessions: 3 },
    { date: '2024-01-08', score: 68, sessions: 2 },
    { date: '2024-01-15', score: 72, sessions: 4 },
    { date: '2024-01-22', score: 75, sessions: 3 },
    { date: '2024-01-29', score: 78, sessions: 5 },
    { date: '2024-02-05', score: 82, sessions: 4 },
    { date: '2024-02-12', score: 85, sessions: 3 },
  ];

  const skillBreakdown = [
    { skill: 'Eye Contact', score: 85, improvement: '+12%' },
    { skill: 'Speech Clarity', score: 78, improvement: '+8%' },
    { skill: 'Body Language', score: 82, improvement: '+15%' },
    { skill: 'Content Quality', score: 75, improvement: '+5%' },
    { skill: 'Confidence', score: 80, improvement: '+10%' },
  ];

  const interviewTypes = [
    { name: 'Technical', value: 35, color: '#3B82F6' },
    { name: 'Behavioral', value: 30, color: '#10B981' },
    { name: 'Quick Practice', value: 25, color: '#F59E0B' },
    { name: 'Full Interview', value: 10, color: '#EF4444' },
  ];

  const achievements = [
    { id: 1, title: 'First Interview', description: 'Completed your first practice session', earned: true, date: '2024-01-15' },
    { id: 2, title: 'Consistency King', description: 'Practiced 5 days in a row', earned: true, date: '2024-01-22' },
    { id: 3, title: 'Eye Contact Master', description: 'Maintained 90%+ eye contact', earned: true, date: '2024-02-01' },
    { id: 4, title: 'Confidence Boost', description: 'Improved confidence score by 20%', earned: false, progress: 75 },
    { id: 5, title: 'Technical Expert', description: 'Aced 10 technical interviews', earned: false, progress: 60 },
  ];

  const stats = {
    totalSessions: 24,
    totalHours: 18.5,
    averageScore: 78,
    improvement: '+15%',
    streak: 7,
    nextGoal: 'Reach 85% average score'
  };

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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalSessions}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Practice Hours</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalHours}h</p>
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
                <p className="text-2xl font-bold text-gray-800">{stats.averageScore}%</p>
                <p className="text-green-600 text-sm">{stats.improvement} this month</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Current Streak</p>
                <p className="text-2xl font-bold text-gray-800">{stats.streak} days</p>
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
              <h3 className="text-lg font-bold text-gray-800">Progress Over Time</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsLineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
                <YAxis domain={[60, 90]} />
                <Tooltip 
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  formatter={(value) => [value + '%', 'Score']}
                />
                <Line type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={3} />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>

          {/* Interview Types Distribution */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <PieChart className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-bold text-gray-800">Interview Types</h3>
            </div>
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
                <Tooltip formatter={(value) => [value + '%', 'Percentage']} />
              </RechartsPieChart>
            </ResponsiveContainer>
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
                    <span className="font-medium text-gray-800">{skill.skill}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 text-sm font-medium">{skill.improvement}</span>
                      <span className="font-bold text-gray-800">{skill.score}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
                  <p className="text-xs text-green-600">Earned on {achievement.date}</p>
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
      </div>
    </div>
  );
}