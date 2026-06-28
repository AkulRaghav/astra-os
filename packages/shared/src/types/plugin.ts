export interface Plugin {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author: string;
  iconUrl?: string;
  category: PluginCategory;
  tags: string[];
  downloads: number;
  rating: number;
  isOfficial: boolean;
  pricing: PluginPricing;
  createdAt: string;
  updatedAt: string;
}

export type PluginCategory =
  | 'productivity'
  | 'development'
  | 'communication'
  | 'design'
  | 'analytics'
  | 'ai'
  | 'integration'
  | 'other';

export type PluginPricing = 'free' | 'paid' | 'freemium';

export interface PluginInstall {
  id: string;
  userId: string;
  pluginId: string;
  installedAt: string;
  isEnabled: boolean;
  config?: Record<string, unknown>;
}
