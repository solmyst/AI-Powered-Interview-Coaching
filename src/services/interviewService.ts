import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

export interface InterviewSession {
  id: string;
  userId: string;
  type: 'quick' | 'full' | 'technical' | 'behavioral';
  duration: number;
  questions: string[];
  currentQuestion: number;
  isActive: boolean;
  startTime: Date;
  endTime?: Date;
  feedback: {
    speech: {
      speakingPace: number;
      fillerWords: number;
      clarity: number;
      volume: number;
    };
    visual: {
      eyeContact: number;
      posture: number;
      gestures: number;
      expressions: number;
    };
    content: {
      relevance: number;
      structure: number;
      depth: number;
      confidence: number;
    };
  };
  overallScore: number;
  improvements: string[];
  strengths: string[];
}

export class InterviewService {
  // Save interview session
  static async saveSession(sessionData: Omit<InterviewSession, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'interviewSessions'), {
        ...sessionData,
        startTime: serverTimestamp(),
        endTime: sessionData.endTime ? serverTimestamp() : null,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to save interview session');
    }
  }

  // Get user's interview sessions
  static async getUserSessions(userId: string, limitCount: number = 10): Promise<InterviewSession[]> {
    try {
      const q = query(
        collection(db, 'interviewSessions'),
        where('userId', '==', userId),
        orderBy('startTime', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const sessions: InterviewSession[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        sessions.push({
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate()
        } as InterviewSession);
      });

      return sessions;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch interview sessions');
    }
  }

  // Get user analytics
  static async getUserAnalytics(userId: string): Promise<{
    totalSessions: number;
    averageScore: number;
    totalPracticeTime: number;
    improvementTrend: number;
    skillBreakdown: {
      speech: number;
      visual: number;
      content: number;
    };
  }> {
    try {
      const sessions = await this.getUserSessions(userId, 100); // Get more sessions for analytics
      
      if (sessions.length === 0) {
        return {
          totalSessions: 0,
          averageScore: 0,
          totalPracticeTime: 0,
          improvementTrend: 0,
          skillBreakdown: { speech: 0, visual: 0, content: 0 }
        };
      }

      const totalSessions = sessions.length;
      const averageScore = sessions.reduce((sum, session) => sum + session.overallScore, 0) / totalSessions;
      const totalPracticeTime = sessions.reduce((sum, session) => sum + session.duration, 0);

      // Calculate improvement trend (last 5 vs previous 5 sessions)
      let improvementTrend = 0;
      if (sessions.length >= 10) {
        const recent5 = sessions.slice(0, 5);
        const previous5 = sessions.slice(5, 10);
        const recentAvg = recent5.reduce((sum, s) => sum + s.overallScore, 0) / 5;
        const previousAvg = previous5.reduce((sum, s) => sum + s.overallScore, 0) / 5;
        improvementTrend = ((recentAvg - previousAvg) / previousAvg) * 100;
      }

      // Calculate skill breakdown
      const speechScores = sessions.map(s => 
        (s.feedback.speech.speakingPace + s.feedback.speech.clarity + s.feedback.speech.volume) / 3
      );
      const visualScores = sessions.map(s => 
        (s.feedback.visual.eyeContact + s.feedback.visual.posture + s.feedback.visual.gestures) / 3
      );
      const contentScores = sessions.map(s => 
        (s.feedback.content.relevance + s.feedback.content.structure + s.feedback.content.depth) / 3
      );

      const skillBreakdown = {
        speech: speechScores.reduce((sum, score) => sum + score, 0) / speechScores.length,
        visual: visualScores.reduce((sum, score) => sum + score, 0) / visualScores.length,
        content: contentScores.reduce((sum, score) => sum + score, 0) / contentScores.length
      };

      return {
        totalSessions,
        averageScore: Math.round(averageScore),
        totalPracticeTime: Math.round(totalPracticeTime / 60), // Convert to hours
        improvementTrend: Math.round(improvementTrend),
        skillBreakdown: {
          speech: Math.round(skillBreakdown.speech),
          visual: Math.round(skillBreakdown.visual),
          content: Math.round(skillBreakdown.content)
        }
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch user analytics');
    }
  }
}