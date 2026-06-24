import type { ProjectRow, ProjectImageRow, ProjectSheetRow, CategoryRow, ProjectTagRow } from './database.js';
import { toPublicUrl } from './storage.js';

export interface Category {
  id?: number;
  name: string;
}

export interface Project {
  id?: number;
  name: string;
  description: string;
  categoryId?: number;
  coverImage?: string;
  version: number;
  status: 'active' | 'archived';
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  sheetWidth: number;
  sheetHeight: number;
  fps: number;
  isFavorite: boolean;
  type: '2d' | '3d';
  createdAt: number;
  updatedAt: number;
}

export interface ProjectImage {
  id?: number;
  projectId: number;
  imageSrc: string;
  fileName: string;
  sortOrder: number;
  isSelected: boolean;
}

export interface ProjectSheet {
  id?: number;
  projectId: number;
  version: number;
  sheetSrc: string;
  reverseSheetSrc?: string;
  sheetWidth: number;
  sheetHeight: number;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  createdAt: number;
}

export interface ProjectTagJoin {
  id?: number;
  projectId: number;
  tagName: string;
}

export function mapCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name };
}

export function mapProject(row: ProjectRow & { resolvedCoverImagePath?: string | null }): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId ?? undefined,
    coverImage: toPublicUrl(row.resolvedCoverImagePath !== undefined ? row.resolvedCoverImagePath : row.coverImagePath),
    version: row.version,
    status: row.status,
    frameWidth: row.frameWidth,
    frameHeight: row.frameHeight,
    frameCount: row.frameCount,
    sheetWidth: row.sheetWidth,
    sheetHeight: row.sheetHeight,
    fps: row.fps,
    isFavorite: row.isFavorite === 1,
    type: row.type || '2d',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapProjectImage(row: ProjectImageRow): ProjectImage {
  return {
    id: row.id,
    projectId: row.projectId,
    imageSrc: toPublicUrl(row.filePath),
    fileName: row.fileName,
    sortOrder: row.sortOrder,
    isSelected: row.isSelected === 1,
  };
}

export function mapProjectSheet(row: ProjectSheetRow): ProjectSheet {
  return {
    id: row.id,
    projectId: row.projectId,
    version: row.version,
    sheetSrc: toPublicUrl(row.filePath),
    reverseSheetSrc: row.reverseFilePath ? toPublicUrl(row.reverseFilePath) : undefined,
    sheetWidth: row.sheetWidth,
    sheetHeight: row.sheetHeight,
    frameCount: row.frameCount,
    frameWidth: row.frameWidth,
    frameHeight: row.frameHeight,
    fps: row.fps,
    createdAt: row.createdAt,
  };
}

export function mapProjectTag(row: ProjectTagRow): ProjectTagJoin {
  return { id: row.id, projectId: row.projectId, tagName: row.tagName };
}
