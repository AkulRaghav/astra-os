export interface AIAgent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  capabilities: string[];
  model: string;
  isActive: boolean;
  config: AgentConfig;
  createdAt: string;
  updatedAt: string;
}

export type AgentType =
  | 'assistant'
  | 'code_helper'
  | 'data_analyst'
  | 'content_writer'
  | 'researcher'
  | 'custom';

export interface AgentConfig {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  memoryEnabled: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  agentId: string;
  userId: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: MessageMetadata;
  createdAt: string;
}

export interface MessageMetadata {
  model?: string;
  tokensUsed?: number;
  toolCalls?: ToolCall[];
  attachments?: string[];
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}
