export interface FileNode {
  id: string;
  name: string;
  type: FileType;
  mimeType?: string;
  size: number;
  parentId?: string;
  path: string;
  storageKey?: string;
  ownerId: string;
  sharedWith: FileShare[];
  createdAt: string;
  updatedAt: string;
}

export type FileType = 'file' | 'folder';

export interface FileShare {
  userId: string;
  permission: FilePermission;
}

export type FilePermission = 'read' | 'write' | 'admin';

export interface StorageQuota {
  used: number;
  total: number;
  unit: 'bytes';
}

export interface FileUploadResult {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
}
