export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type NotificationType =
  | 'system'
  | 'file_shared'
  | 'task_assigned'
  | 'task_completed'
  | 'calendar_reminder'
  | 'email_received'
  | 'ai_completed'
  | 'collaboration_invite'
  | 'plugin_update';
