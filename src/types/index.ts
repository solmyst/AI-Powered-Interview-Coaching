export type User = {
  id: string;
  name: string;
  email: string;
  subscription: 'free' | 'premium' | 'professional';
  avatar?: string;
};

export type InterviewSession = {
  id: string;
  type: 'quick' | 'full' | 'technical' | 'behavioral';
  duration: number;
  questions: string[];
  currentQuestion: number;
  isActive: boolean;
  startTime?: Date;
  feedback?: {
    speech: Record<string, unknown>;
    visual: Record<string, unknown>;
    content: Record<string, unknown>;
  };
};

export type Page = 'landing' | 'dashboard' | 'interview' | 'analytics';
