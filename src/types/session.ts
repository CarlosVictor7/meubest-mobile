export type SessionStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'rejected';
export type SessionType = 'immediate' | 'scheduled' | 'specific';

export interface Session {
  id: string;
  speakerId: string;
  listenerId: string | null;
  status: SessionStatus;
  category: string;
  duration: number; // minutes
  type: SessionType;
  createdAt: any; // Firestore Timestamp
  selectedTime?: string;
  speakerEmail?: string;
  listenerEmail?: string;
  price?: number;
  actualDuration?: number;
  completedAt?: any;
}

export interface Review {
  id: string;
  sessionId: string;
  fromId: string;
  toId: string;
  rating: number;
  comment?: string;
  isPublic: boolean;
  visibleAt: string;
  createdAt: any;
}

export interface Report {
  id: string;
  sessionId: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  comment?: string;
  status: 'pending' | 'resolved';
  createdAt: string;
}

export interface Transcript {
  text: string;
  speakerId: string;
  timestamp: any;
}
