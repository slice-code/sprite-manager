import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from './database.js';

export function ensureProjectDirs(projectId: number) {
  const base = path.join(UPLOADS_DIR, 'projects', String(projectId));
  fs.mkdirSync(path.join(base, 'frames'), { recursive: true });
  fs.mkdirSync(path.join(base, 'sheets'), { recursive: true });
  return base;
}

/** Relative path from uploads dir, e.g. projects/1/frames/foo.png */
export function toRelativePath(absolutePath: string): string {
  return path.relative(UPLOADS_DIR, absolutePath).split(path.sep).join('/');
}

export function toAbsolutePath(relativePath: string): string {
  return path.join(UPLOADS_DIR, relativePath);
}

export function toPublicUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return '';
  return `/uploads/${relativePath}`;
}

export function saveBase64Png(base64OrDataUrl: string, absoluteDest: string): void {
  const base64 = base64OrDataUrl.replace(/^data:image\/\w+;base64,/, '');
  fs.mkdirSync(path.dirname(absoluteDest), { recursive: true });
  fs.writeFileSync(absoluteDest, Buffer.from(base64, 'base64'));
}

export function saveBuffer(buffer: Buffer, absoluteDest: string): void {
  fs.mkdirSync(path.dirname(absoluteDest), { recursive: true });
  fs.writeFileSync(absoluteDest, buffer);
}

export function deleteFileIfExists(relativePath: string | null | undefined): void {
  if (!relativePath) return;
  const abs = toAbsolutePath(relativePath);
  if (fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
}

export function deleteProjectFiles(projectId: number): void {
  const dir = path.join(UPLOADS_DIR, 'projects', String(projectId));
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function uniqueFramePath(projectId: number, fileName: string): { absolute: string; relative: string } {
  ensureProjectDirs(projectId);
  const safe = sanitizeFileName(fileName);
  const base = path.join(UPLOADS_DIR, 'projects', String(projectId), 'frames');
  let dest = path.join(base, safe);
  let counter = 1;
  const ext = path.extname(safe);
  const stem = path.basename(safe, ext);
  while (fs.existsSync(dest)) {
    dest = path.join(base, `${stem}_${counter}${ext}`);
    counter++;
  }
  const relative = toRelativePath(dest);
  return { absolute: dest, relative };
}

export function sheetFilePath(projectId: number, version: number): { absolute: string; relative: string } {
  ensureProjectDirs(projectId);
  const relative = `projects/${projectId}/sheets/sheet_v${version}.png`;
  return { absolute: toAbsolutePath(relative), relative };
}

export function reversedSheetFilePath(projectId: number, version: number): { absolute: string; relative: string } {
  ensureProjectDirs(projectId);
  const relative = `projects/${projectId}/sheets/sheet_v${version}_reverse.png`;
  return { absolute: toAbsolutePath(relative), relative };
}
