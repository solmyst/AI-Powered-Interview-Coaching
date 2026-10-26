import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ---- Types ----

export interface SessionRecord {
  id: string;
  type: 'quick' | 'full' | 'technical' | 'behavioral';
  date: string;            // ISO string
  duration: number;        // seconds
  questionsCount: number;
  questionsAnswered: number;
  transcript: string;

  // Scores (0-100)
  overallScore: number;
  scores: {
    eyeContact: number;
    speechClarity: number;
    bodyLanguage: number;
    contentQuality: number;
    confidence: number;
    speakingPace: number;
  };

  // Speech metrics
  fillerWordCount: number;
  fillerWords: { word: string; count: number }[];
  wordsPerMinute: number;
  totalWords: number;
  longestSilence: number;

  // Feedback
  strengths: string[];
  improvements: string[];
}

export interface UserStats {
  totalSessions: number;
  averageScore: number;
  improvement: number;       // % change recent vs older
  totalPracticeMinutes: number;
  currentStreak: number;
  bestStreak: number;
  lastSessionDate: string | null;
}

export interface SkillProgress {
  name: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  history: number[];         // last N scores
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  date?: string;
  progress?: number;         // 0-100 for unearned
}

// ---- IndexedDB Schema ----

interface InterviewDB extends DBSchema {
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: {
      'by-date': string;
      'by-type': string;
    };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

// ---- Service ----

export class SessionStorageService {
  private db: IDBPDatabase<InterviewDB> | null = null;

  async initialize(): Promise<void> {
    this.db = await openDB<InterviewDB>('interviewace-db', 1, {
      upgrade(db) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionStore.createIndex('by-date', 'date');
        sessionStore.createIndex('by-type', 'type');

        db.createObjectStore('settings', { keyPath: 'key' });
      }
    });
    console.log('[SessionStorage] IndexedDB initialized');
  }

  // ---- Session CRUD ----

  async saveSession(session: SessionRecord): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');
    await this.db.put('sessions', session);
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    if (!this.db) throw new Error('DB not initialized');
    return this.db.get('sessions', id);
  }

  async getAllSessions(): Promise<SessionRecord[]> {
    if (!this.db) throw new Error('DB not initialized');
    const sessions = await this.db.getAll('sessions');
    // Sort by date descending
    return sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getRecentSessions(count: number = 5): Promise<SessionRecord[]> {
    const all = await this.getAllSessions();
    return all.slice(0, count);
  }

  async deleteSession(id: string): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');
    await this.db.delete('sessions', id);
  }

  // ---- Analytics ----

  async getUserStats(): Promise<UserStats> {
    const sessions = await this.getAllSessions();

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        improvement: 0,
        totalPracticeMinutes: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastSessionDate: null
      };
    }

    const totalSessions = sessions.length;
    const averageScore = Math.round(
      sessions.reduce((sum, s) => sum + s.overallScore, 0) / totalSessions
    );
    const totalPracticeMinutes = Math.round(
      sessions.reduce((sum, s) => sum + s.duration, 0) / 60
    );

    // Improvement: compare last 3 vs previous 3
    let improvement = 0;
    if (sessions.length >= 6) {
      const recent = sessions.slice(0, 3);
      const older = sessions.slice(3, 6);
      const recentAvg = recent.reduce((s, x) => s + x.overallScore, 0) / 3;
      const olderAvg = older.reduce((s, x) => s + x.overallScore, 0) / 3;
      improvement = Math.round(((recentAvg - olderAvg) / Math.max(olderAvg, 1)) * 100);
    } else if (sessions.length >= 2) {
      improvement = sessions[0].overallScore - sessions[sessions.length - 1].overallScore;
    }

    // Streak calculation
    const streakData = this.calculateStreak(sessions);

    return {
      totalSessions,
      averageScore,
      improvement,
      totalPracticeMinutes,
      currentStreak: streakData.current,
      bestStreak: streakData.best,
      lastSessionDate: sessions[0]?.date || null
    };
  }

  async getSkillProgress(): Promise<SkillProgress[]> {
    const sessions = await this.getAllSessions();
    if (sessions.length === 0) {
      return [
        { name: 'Eye Contact', score: 0, trend: 'stable', history: [] },
        { name: 'Speech Clarity', score: 0, trend: 'stable', history: [] },
        { name: 'Body Language', score: 0, trend: 'stable', history: [] },
        { name: 'Confidence', score: 0, trend: 'stable', history: [] },
      ];
    }

    const skills = [
      { name: 'Eye Contact', key: 'eyeContact' as const },
      { name: 'Speech Clarity', key: 'speechClarity' as const },
      { name: 'Body Language', key: 'bodyLanguage' as const },
      { name: 'Confidence', key: 'confidence' as const },
    ];

    return skills.map(skill => {
      const history = sessions.slice(0, 10).map(s => s.scores[skill.key]).reverse();
      const currentScore = history.length > 0 ? history[history.length - 1] : 0;

      // Determine trend from last 3 sessions
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (history.length >= 3) {
        const recent = history.slice(-2).reduce((a, b) => a + b, 0) / 2;
        const older = history.slice(-4, -2).reduce((a, b) => a + b, 0) / Math.min(2, history.slice(-4, -2).length || 1);
        if (recent > older + 3) trend = 'up';
        else if (recent < older - 3) trend = 'down';
      }

      return {
        name: skill.name,
        score: currentScore,
        trend,
        history
      };
    });
  }

  async getProgressChartData(): Promise<{ date: string; score: number; sessions: number }[]> {
    const sessions = await this.getAllSessions();
    if (sessions.length === 0) return [];

    // Group by week
    const weekMap = new Map<string, { scores: number[]; count: number }>();

    sessions.forEach(session => {
      const date = new Date(session.date);
      // Get start of week
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { scores: [], count: 0 });
      }
      const week = weekMap.get(weekKey)!;
      week.scores.push(session.overallScore);
      week.count++;
    });

    return Array.from(weekMap.entries())
      .map(([date, data]) => ({
        date,
        score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        sessions: data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12); // Last 12 weeks
  }

  async getInterviewTypeDistribution(): Promise<{ name: string; value: number; color: string }[]> {
    const sessions = await this.getAllSessions();
    if (sessions.length === 0) return [];

    const typeCounts = { quick: 0, full: 0, technical: 0, behavioral: 0 };
    sessions.forEach(s => { typeCounts[s.type]++; });

    const total = sessions.length;
    const colors: Record<string, string> = {
      quick: '#F59E0B',
      full: '#EF4444',
      technical: '#3B82F6',
      behavioral: '#10B981'
    };
    const names: Record<string, string> = {
      quick: 'Quick Practice',
      full: 'Full Interview',
      technical: 'Technical',
      behavioral: 'Behavioral'
    };

    return Object.entries(typeCounts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({
        name: names[type] || type,
        value: Math.round((count / total) * 100),
        color: colors[type] || '#6B7280'
      }));
  }

  async getAchievements(): Promise<Achievement[]> {
    const sessions = await this.getAllSessions();
    const stats = await this.getUserStats();

    const achievements: Achievement[] = [
      {
        id: 'first-interview',
        title: 'First Interview',
        description: 'Completed your first practice session',
        earned: sessions.length >= 1,
        date: sessions.length >= 1 ? sessions[sessions.length - 1].date : undefined,
        progress: sessions.length >= 1 ? 100 : 0
      },
      {
        id: 'five-sessions',
        title: 'Getting Serious',
        description: 'Completed 5 practice sessions',
        earned: sessions.length >= 5,
        date: sessions.length >= 5 ? sessions[sessions.length - 5]?.date : undefined,
        progress: Math.min(100, Math.round((sessions.length / 5) * 100))
      },
      {
        id: 'ten-sessions',
        title: 'Dedicated Learner',
        description: 'Completed 10 practice sessions',
        earned: sessions.length >= 10,
        progress: Math.min(100, Math.round((sessions.length / 10) * 100))
      },
      {
        id: 'eye-contact-master',
        title: 'Eye Contact Master',
        description: 'Achieved 90%+ eye contact score in a session',
        earned: sessions.some(s => s.scores.eyeContact >= 90),
        date: sessions.find(s => s.scores.eyeContact >= 90)?.date,
        progress: Math.min(100, Math.round((Math.max(0, ...sessions.map(s => s.scores.eyeContact)) / 90) * 100))
      },
      {
        id: 'no-fillers',
        title: 'Clean Speaker',
        description: 'Complete a session with 0 filler words',
        earned: sessions.some(s => s.fillerWordCount === 0 && s.totalWords > 20),
        date: sessions.find(s => s.fillerWordCount === 0 && s.totalWords > 20)?.date,
        progress: sessions.length > 0
          ? Math.min(100, Math.round(100 - (Math.min(...sessions.map(s => s.fillerWordCount)) * 10)))
          : 0
      },
      {
        id: 'high-score',
        title: 'Top Performer',
        description: 'Achieve an overall score of 85% or higher',
        earned: sessions.some(s => s.overallScore >= 85),
        date: sessions.find(s => s.overallScore >= 85)?.date,
        progress: Math.min(100, Math.round((Math.max(0, ...sessions.map(s => s.overallScore)) / 85) * 100))
      },
      {
        id: 'streak-3',
        title: 'Consistency Champion',
        description: 'Practice 3 days in a row',
        earned: stats.bestStreak >= 3,
        progress: Math.min(100, Math.round((stats.bestStreak / 3) * 100))
      },
      {
        id: 'all-types',
        title: 'Well Rounded',
        description: 'Try all 4 interview types',
        earned: new Set(sessions.map(s => s.type)).size >= 4,
        progress: Math.min(100, Math.round((new Set(sessions.map(s => s.type)).size / 4) * 100))
      }
    ];

    return achievements;
  }

  // ---- Helpers ----

  private calculateStreak(sessions: SessionRecord[]): { current: number; best: number } {
    if (sessions.length === 0) return { current: 0, best: 0 };

    // Get unique dates (sorted descending)
    const dates = [...new Set(sessions.map(s => s.date.split('T')[0]))].sort().reverse();

    let current = 0;
    let best = 0;
    let streak = 1;

    // Check if most recent session was today or yesterday
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (dates[0] !== today && dates[0] !== yesterday) {
      current = 0;
    } else {
      for (let i = 0; i < dates.length - 1; i++) {
        const curr = new Date(dates[i]).getTime();
        const next = new Date(dates[i + 1]).getTime();
        const diffDays = (curr - next) / 86400000;

        if (diffDays === 1) {
          streak++;
        } else {
          if (i === 0 || streak > best) best = streak;
          streak = 1;
        }
      }
      current = streak;
      best = Math.max(best, streak);
    }

    return { current, best };
  }

  /**
   * Generate strengths and improvements from session scores.
   */
  static generateFeedback(scores: SessionRecord['scores'], fillerWordCount: number, wpm: number): {
    strengths: string[];
    improvements: string[];
  } {
    const strengths: string[] = [];
    const improvements: string[] = [];

    const hasSpeech = wpm > 0;
    const hasVisual = scores.eyeContact > 0 || scores.bodyLanguage > 0;

    // Eye contact
    if (hasVisual) {
      if (scores.eyeContact >= 80) {
        strengths.push('Maintained excellent eye contact throughout the session');
      } else if (scores.eyeContact >= 60) {
        improvements.push('Try to maintain more consistent eye contact with the camera');
      } else {
        improvements.push('Focus on looking directly at the camera to simulate eye contact');
      }
    }

    // Speech metrics
    if (hasSpeech) {
      // Speech clarity
      if (scores.speechClarity >= 80) {
        strengths.push('Spoke clearly and articulately');
      } else if (scores.speechClarity < 60) {
        improvements.push('Work on speaking more clearly — enunciate your words');
      }

      // Filler words
      if (fillerWordCount === 0) {
        strengths.push('No filler words detected — excellent verbal precision');
      } else if (fillerWordCount <= 3) {
        strengths.push('Minimal use of filler words');
      } else if (fillerWordCount <= 8) {
        improvements.push(`Reduce filler words (detected ${fillerWordCount}) — try pausing instead of saying "um" or "uh"`);
      } else {
        improvements.push(`High filler word count (${fillerWordCount}). Practice pausing to collect your thoughts instead`);
      }

      // Speaking pace
      if (wpm >= 120 && wpm <= 150) {
        strengths.push('Speaking pace was ideal for interview communication');
      } else if (wpm > 160) {
        improvements.push('Slow down your speaking pace — you were speaking too quickly');
      } else if (wpm > 0 && wpm < 100) {
        improvements.push('Try to speak a bit faster to maintain engagement');
      }
    } else {
      improvements.push('No speech was detected. Make sure your microphone is active and you are responding to the questions.');
    }

    // Body language
    if (hasVisual) {
      if (scores.bodyLanguage >= 80) {
        strengths.push('Demonstrated confident and steady body language');
      } else if (scores.bodyLanguage < 60) {
        improvements.push('Work on maintaining a steadier posture — avoid excessive head movement');
      }
    } else {
      improvements.push('No visual data detected. Ensure your camera is properly positioned and your face is visible.');
    }

    // Confidence
    if (hasSpeech && scores.confidence >= 80) {
      strengths.push('Projected strong confidence throughout the session');
    } else if (hasSpeech && scores.confidence < 60) {
      improvements.push('Build confidence by maintaining eye contact and speaking steadily');
    }

    // Ensure at least one of each
    if (strengths.length === 0) {
      if (!hasSpeech && !hasVisual) {
        strengths.push('Session completed. Please ensure hardware is working for your next practice.');
      } else {
        strengths.push('Completed the interview session — keep practicing to improve');
      }
    }
    if (improvements.length === 0) {
      improvements.push('Great performance! Challenge yourself with harder question types');
    }

    return { strengths, improvements };
  }
}
