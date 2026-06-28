export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  plan: PlanTier;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'user' | 'admin' | 'superadmin';
export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface UserProfile {
  id: string;
  userId: string;
  bio?: string;
  timezone: string;
  language: string;
  theme: ThemePreference;
  notificationsEnabled: boolean;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Session {
  id: string;
  userId: string;
  deviceName: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
