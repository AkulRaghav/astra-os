export interface Email {
  id: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  folder: MailFolder;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
  threadId?: string;
  ownerId: string;
  receivedAt: string;
  sentAt?: string;
}

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
}

export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'archive';
