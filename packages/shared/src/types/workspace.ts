export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: WorkspaceMember[];
  type: WorkspaceType;
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceType = 'personal' | 'team' | 'collaboration';

export interface WorkspaceMember {
  userId: string;
  role: WorkspaceMemberRole;
  joinedAt: string;
}

export type WorkspaceMemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface CollaborationBoard {
  id: string;
  workspaceId: string;
  name: string;
  content: string; // CRDT document state
  activeUsers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  color: string;
  displayName: string;
}
