/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Shared TypeScript type definitions for the application

export interface User {
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerUsername: string;
  status: "active" | "inactive";
  isProtected: boolean;
  passwordHash: string | null;
  passwordSalt: string | null;
  filesCount: number;
  createdAt: string;
  accessCount?: number;
  lastAccessedAt?: string;
}

export interface Session {
  id: string;
  username: string;
  expiresAt: string;
}

export interface StorageConfig {
  customPath: string;
}

export interface DatabaseSchema {
  users: User[];
  projects: Project[];
  sessions: Session[];
  storageConfig?: StorageConfig;
}

export interface UploadFilePayload {
  path: string;
  content: string; // Base64 or Text representation
  isBinary: boolean;
}

export interface ProjectUploadRequest {
  name: string;
  files: UploadFilePayload[];
}
