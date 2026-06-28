export interface BillingInfo {
  id: string;
  userId: string;
  plan: BillingPlan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  status: SubscriptionStatus;
}

export interface BillingPlan {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: PlanLimits;
}

export interface PlanLimits {
  storageGb: number;
  aiRequestsPerDay: number;
  maxCollaborators: number;
  maxPlugins: number;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  pdfUrl?: string;
  createdAt: string;
}
