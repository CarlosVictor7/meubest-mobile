export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'reward' | 'commission' | 'withdrawal';
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: any;
  stripeSessionId?: string;
  sessionId?: string;
  fromId?: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'completed' | 'rejected';
  pixKey?: string;
  bankName?: string;
  createdAt: any;
  processedAt?: any;
  processedBy?: string;
  stripePayoutId?: string;
}

export interface Tip {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  sessionId?: string;
  createdAt: any;
}
