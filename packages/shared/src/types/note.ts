export interface Note {
  id: string;
  title: string;
  content: string;
  format: NoteFormat;
  tags: string[];
  ownerId: string;
  folderId?: string;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NoteFormat = 'markdown' | 'richtext' | 'plaintext';
