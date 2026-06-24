export interface Category {
  id?: number;
  name: string;
}

export interface Tag {
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

const API_BASE = '/api';

async function parseErrorResponse(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({ error: res.statusText }));
  return err.error || 'Request failed';
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  return res.json();
}

async function requestForm<T>(path: string, formData: FormData, method = 'POST'): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    body: formData,
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  return res.json();
}

export async function seedDatabase(): Promise<void> {
  await requestJson('/seed', { method: 'POST' });
}

export async function getProjects(params?: {
  search?: string | string[];
  categoryId?: number | null;
  status?: string;
  isFavorite?: boolean;
  sortBy?: string;
  frameCount?: number | null;
  type?: '2d' | '3d';
}): Promise<{
  projects: Project[];
  stats: {
    totalProjectsCount: number;
    activeProjectsCount: number;
    favoriteCount: number;
    totalFrames: number;
    totalGeneratedSheets: number;
  };
}> {
  const query = new URLSearchParams();
  if (params) {
    if (params.search) {
      const searchVal = Array.isArray(params.search) ? params.search.join(',') : params.search;
      query.append('search', searchVal);
    }
    if (params.categoryId !== undefined && params.categoryId !== null) {
      query.append('categoryId', String(params.categoryId));
    }
    if (params.status) query.append('status', params.status);
    if (params.isFavorite !== undefined) query.append('isFavorite', String(params.isFavorite));
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.frameCount !== undefined && params.frameCount !== null) {
      query.append('frameCount', String(params.frameCount));
    }
    if (params.type) query.append('type', params.type);
  }
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return requestJson(`/projects${queryString}`);
}

export async function getProject(id: number): Promise<Project | undefined> {
  try {
    return await requestJson(`/projects/${id}`);
  } catch {
    return undefined;
  }
}

export async function createProject(data: {
  name: string;
  description: string;
  categoryId: number;
  tags: string[];
  type?: '2d' | '3d';
}): Promise<Project> {
  return requestJson('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: number, data: Partial<Project>): Promise<Project> {
  return requestJson(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: number): Promise<void> {
  await requestJson(`/projects/${id}`, { method: 'DELETE' });
}

export async function duplicateProject(id: number): Promise<Project> {
  return requestJson(`/projects/${id}/duplicate`, { method: 'POST' });
}

export async function getCategories(): Promise<Category[]> {
  return requestJson('/categories');
}

export async function getAllTagNames(): Promise<string[]> {
  return requestJson('/tags');
}

export async function getProjectTags(projectId: number): Promise<ProjectTagJoin[]> {
  return requestJson(`/projects/${projectId}/tags`);
}

export async function addProjectTag(projectId: number, tagName: string): Promise<void> {
  await requestJson(`/projects/${projectId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagName }),
  });
}

export async function removeProjectTag(projectId: number, tagName: string): Promise<void> {
  await requestJson(`/projects/${projectId}/tags/${encodeURIComponent(tagName)}`, { method: 'DELETE' });
}

export async function getProjectImages(projectId: number): Promise<ProjectImage[]> {
  return requestJson(`/projects/${projectId}/images`);
}

export async function addProjectImages(
  projectId: number,
  files: File[]
): Promise<{ images: ProjectImage[]; project: Project }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file, file.name);
  }
  return requestForm(`/projects/${projectId}/images`, formData);
}

export async function uploadProjectCover(projectId: number, file: File): Promise<Project> {
  const formData = new FormData();
  formData.append('cover', file, file.name);
  return requestForm(`/projects/${projectId}/cover`, formData);
}

export async function updateProjectImage(id: number, data: { isSelected?: boolean; sortOrder?: number }): Promise<ProjectImage> {
  return requestJson(`/images/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProjectImage(id: number): Promise<void> {
  await requestJson(`/images/${id}`, { method: 'DELETE' });
}

export async function sortProjectImagesByName(projectId: number): Promise<ProjectImage[]> {
  return requestJson(`/projects/${projectId}/images/sort-by-name`, { method: 'POST' });
}

export async function selectAllProjectImages(projectId: number, selected: boolean): Promise<ProjectImage[]> {
  return requestJson(`/projects/${projectId}/images/select-all`, {
    method: 'POST',
    body: JSON.stringify({ selected }),
  });
}

export async function swapProjectImages(
  projectId: number,
  imageIdA: number,
  sortOrderA: number,
  imageIdB: number,
  sortOrderB: number
): Promise<ProjectImage[]> {
  return requestJson(`/projects/${projectId}/images/swap`, {
    method: 'POST',
    body: JSON.stringify({ imageIdA, sortOrderA, imageIdB, sortOrderB }),
  });
}

export async function getProjectSheets(projectId: number): Promise<ProjectSheet[]> {
  return requestJson(`/projects/${projectId}/sheets`);
}

export async function saveProjectSheet(
  projectId: number,
  data: {
    sheetBlob: Blob;
    reverseBlob: Blob;
    sheetWidth: number;
    sheetHeight: number;
    frameCount: number;
    frameWidth: number;
    frameHeight: number;
    fps: number;
  }
): Promise<{ project: Project; sheets: ProjectSheet[] }> {
  const formData = new FormData();
  formData.append('sheet', data.sheetBlob, 'sheet.png');
  formData.append('reverse', data.reverseBlob, 'sheet_reverse.png');
  formData.append('sheetWidth', String(data.sheetWidth));
  formData.append('sheetHeight', String(data.sheetHeight));
  formData.append('frameCount', String(data.frameCount));
  formData.append('frameWidth', String(data.frameWidth));
  formData.append('frameHeight', String(data.frameHeight));
  formData.append('fps', String(data.fps));
  return requestForm(`/projects/${projectId}/sheets`, formData);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
