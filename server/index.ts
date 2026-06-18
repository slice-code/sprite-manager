import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, UPLOADS_DIR } from './database.js';
import { seedDatabase } from './seed.js';
import {
  deleteFileIfExists,
  deleteProjectFiles,
  saveBuffer,
  sheetFilePath,
  reversedSheetFilePath,
  uniqueFramePath,
} from './storage.js';
import {
  mapCategory,
  mapProject,
  mapProjectImage,
  mapProjectSheet,
  mapProjectTag,
} from './mappers.js';
import { uploadFrameImages, uploadSpriteSheet } from './upload.js';
import { getImageDimensions } from './imageValidation.js';
import { sortByNumericFilename, sortRecordsByNumericFilename } from './fileSort.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/uploads', express.static(UPLOADS_DIR));

function clearProjectSheets(projectId: number) {
  const db = getDb();
  const sheets = db.prepare('SELECT filePath, reverseFilePath FROM project_sheets WHERE projectId = ?').all(projectId) as {
    filePath: string;
    reverseFilePath: string | null;
  }[];

  for (const sheet of sheets) {
    deleteFileIfExists(sheet.filePath);
    deleteFileIfExists(sheet.reverseFilePath);
  }
  db.prepare('DELETE FROM project_sheets WHERE projectId = ?').run(projectId);

  const sheetsDir = path.join(UPLOADS_DIR, 'projects', String(projectId), 'sheets');
  if (fs.existsSync(sheetsDir)) {
    fs.rmSync(sheetsDir, { recursive: true, force: true });
    fs.mkdirSync(sheetsDir, { recursive: true });
  }
}

function reorderProjectImagesByFilename(projectId: number) {
  const db = getDb();
  const images = db.prepare('SELECT id, fileName FROM project_images WHERE projectId = ?').all(projectId) as {
    id: number;
    fileName: string;
  }[];
  const sorted = sortRecordsByNumericFilename(images);
  sorted.forEach((img, index) => {
    db.prepare('UPDATE project_images SET sortOrder = ? WHERE id = ?').run(index, img.id);
  });
}

function deleteProjectCascade(projectId: number) {
  const db = getDb();
  const images = db.prepare('SELECT filePath FROM project_images WHERE projectId = ?').all(projectId) as { filePath: string }[];
  const sheets = db.prepare('SELECT filePath, reverseFilePath FROM project_sheets WHERE projectId = ?').all(projectId) as {
    filePath: string; reverseFilePath: string | null;
  }[];

  db.prepare('DELETE FROM project_tags WHERE projectId = ?').run(projectId);
  db.prepare('DELETE FROM project_images WHERE projectId = ?').run(projectId);
  db.prepare('DELETE FROM project_sheets WHERE projectId = ?').run(projectId);
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

  for (const img of images) deleteFileIfExists(img.filePath);
  for (const sheet of sheets) {
    deleteFileIfExists(sheet.filePath);
    deleteFileIfExists(sheet.reverseFilePath);
  }
  deleteProjectFiles(projectId);
}

// --- Seed ---
app.post('/api/seed', async (_req, res) => {
  try {
    const result = await seedDatabase();
    res.json(result);
  } catch (err) {
    console.error('Seed failed:', err);
    res.status(500).json({ error: 'Failed to seed database' });
  }
});

// --- Categories ---
app.get('/api/categories', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(rows.map((r) => mapCategory(r as Parameters<typeof mapCategory>[0])));
});

// --- Projects list ---
app.get('/api/projects', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM projects').all() as Parameters<typeof mapProject>[0][];
  res.json(rows.map(mapProject));
});

app.get('/api/projects/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as Parameters<typeof mapProject>[0] | undefined;
  if (!row) return res.status(404).json({ error: 'Project not found' });
  res.json(mapProject(row));
});

app.post('/api/projects', (req, res) => {
  const db = getDb();
  const { name, description, categoryId, tags = [], frameWidth = 64, frameHeight = 64, fps = 10 } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO projects (name, description, categoryId, coverImagePath, version, status,
      frameWidth, frameHeight, frameCount, sheetWidth, sheetHeight, fps, isFavorite, createdAt, updatedAt)
    VALUES (?, ?, ?, NULL, 0, 'active', ?, ?, 0, 0, 0, ?, 0, ?, ?)
  `).run(name.trim(), description || '', categoryId || null, frameWidth, frameHeight, fps, now, now);

  const projectId = Number(result.lastInsertRowid);

  for (const rawTag of tags as string[]) {
    const tagName = rawTag.trim().toLowerCase();
    if (!tagName) continue;
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName);
    db.prepare('INSERT INTO project_tags (projectId, tagName) VALUES (?, ?)').run(projectId, tagName);
  }

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Parameters<typeof mapProject>[0];
  res.status(201).json(mapProject(row));
});

app.patch('/api/projects/:id', (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const allowed = ['name', 'description', 'categoryId', 'coverImagePath', 'version', 'status',
    'frameWidth', 'frameHeight', 'frameCount', 'sheetWidth', 'sheetHeight', 'fps', 'isFavorite', 'updatedAt'] as const;

  const updates: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in req.body) {
      let val = req.body[key];
      if (key === 'isFavorite') val = val ? 1 : 0;
      if (key === 'status' && val !== 'active' && val !== 'archived') continue;
      updates.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  values.push(projectId);
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Parameters<typeof mapProject>[0];
  res.json(mapProject(row));
});

app.delete('/api/projects/:id', (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  const existing = getDb().prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  deleteProjectCascade(projectId);
  res.json({ ok: true });
});

app.post('/api/projects/:id/duplicate', (req, res) => {
  const db = getDb();
  const origId = parseInt(req.params.id, 10);
  const orig = db.prepare('SELECT * FROM projects WHERE id = ?').get(origId) as Parameters<typeof mapProject>[0] | undefined;
  if (!orig) return res.status(404).json({ error: 'Project not found' });

  const now = Date.now();
  const dupResult = db.prepare(`
    INSERT INTO projects (name, description, categoryId, coverImagePath, version, status,
      frameWidth, frameHeight, frameCount, sheetWidth, sheetHeight, fps, isFavorite, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    `${orig.name} (Copy)`,
    orig.description,
    orig.categoryId,
    orig.coverImagePath,
    orig.version,
    orig.status,
    orig.frameWidth,
    orig.frameHeight,
    orig.frameCount,
    orig.sheetWidth,
    orig.sheetHeight,
    orig.fps,
    now,
    now
  );

  const dupId = Number(dupResult.lastInsertRowid);

  const tags = db.prepare('SELECT tagName FROM project_tags WHERE projectId = ?').all(origId) as { tagName: string }[];
  for (const t of tags) {
    db.prepare('INSERT INTO project_tags (projectId, tagName) VALUES (?, ?)').run(dupId, t.tagName);
  }

  const images = db.prepare('SELECT * FROM project_images WHERE projectId = ? ORDER BY sortOrder').all(origId) as {
    filePath: string; fileName: string; sortOrder: number; isSelected: number;
  }[];

  for (const img of images) {
    const { absolute, relative } = uniqueFramePath(dupId, img.fileName);
    fs.copyFileSync(path.join(UPLOADS_DIR, img.filePath), absolute);
    db.prepare(`
      INSERT INTO project_images (projectId, filePath, fileName, sortOrder, isSelected)
      VALUES (?, ?, ?, ?, ?)
    `).run(dupId, relative, img.fileName, img.sortOrder, img.isSelected);
  }

  const sheets = db.prepare('SELECT * FROM project_sheets WHERE projectId = ? ORDER BY version').all(origId) as {
    filePath: string; reverseFilePath: string | null; version: number; sheetWidth: number; sheetHeight: number;
    frameCount: number; frameWidth: number; frameHeight: number; fps: number; createdAt: number;
  }[];

  for (const sheet of sheets) {
    const { absolute, relative } = sheetFilePath(dupId, sheet.version);
    fs.copyFileSync(path.join(UPLOADS_DIR, sheet.filePath), absolute);

    let reverseRelative: string | null = null;
    if (sheet.reverseFilePath) {
      const reversed = reversedSheetFilePath(dupId, sheet.version);
      fs.copyFileSync(path.join(UPLOADS_DIR, sheet.reverseFilePath), reversed.absolute);
      reverseRelative = reversed.relative;
    }

    db.prepare(`
      INSERT INTO project_sheets (projectId, version, filePath, reverseFilePath, sheetWidth, sheetHeight, frameCount, frameWidth, frameHeight, fps, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(dupId, sheet.version, relative, reverseRelative, sheet.sheetWidth, sheet.sheetHeight, sheet.frameCount, sheet.frameWidth, sheet.frameHeight, sheet.fps, sheet.createdAt);
  }

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(dupId) as Parameters<typeof mapProject>[0];
  res.status(201).json(mapProject(row));
});

// --- Tags (global list) ---
app.get('/api/tags', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT tagName FROM project_tags').all() as { tagName: string }[];
  const unique = Array.from(new Set(rows.map((r) => r.tagName)));
  res.json(unique);
});

app.get('/api/projects/:id/tags', (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  const rows = db.prepare('SELECT * FROM project_tags WHERE projectId = ?').all(projectId) as Parameters<typeof mapProjectTag>[0][];
  res.json(rows.map(mapProjectTag));
});

app.post('/api/projects/:id/tags', (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  const tagName = (req.body.tagName as string)?.trim().toLowerCase();
  if (!tagName) return res.status(400).json({ error: 'Tag name required' });

  const exists = db.prepare('SELECT id FROM project_tags WHERE projectId = ? AND tagName = ?').get(projectId, tagName);
  if (exists) return res.json({ ok: true });

  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName);
  db.prepare('INSERT INTO project_tags (projectId, tagName) VALUES (?, ?)').run(projectId, tagName);

  const rows = db.prepare('SELECT * FROM project_tags WHERE projectId = ?').all(projectId) as Parameters<typeof mapProjectTag>[0][];
  res.json(rows.map(mapProjectTag));
});

app.delete('/api/projects/:id/tags/:tagName', (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM project_tags WHERE projectId = ? AND tagName = ?').run(projectId, req.params.tagName);
  res.json({ ok: true });
});

// --- Images ---
app.get('/api/projects/:id/images', (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  const rows = db.prepare('SELECT * FROM project_images WHERE projectId = ? ORDER BY sortOrder ASC').all(projectId) as Parameters<typeof mapProjectImage>[0][];
  res.json(rows.map(mapProjectImage));
});

app.post('/api/projects/:id/images', uploadFrameImages.array('images', 50), (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Parameters<typeof mapProject>[0] | undefined;
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No images provided. Use multipart field "images".' });
  }

  try {
    const sortedFiles = sortByNumericFilename(files);
    const existingCount = (db.prepare('SELECT COUNT(*) as c FROM project_images WHERE projectId = ?').get(projectId) as { c: number }).c;
    const { width, height } = getImageDimensions(sortedFiles[0].buffer);

    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      const { absolute, relative } = uniqueFramePath(projectId, file.originalname);
      saveBuffer(file.buffer, absolute);

      db.prepare(`
        INSERT INTO project_images (projectId, filePath, fileName, sortOrder, isSelected)
        VALUES (?, ?, ?, ?, 1)
      `).run(projectId, relative, file.originalname, existingCount + i);
    }

    const proj = db.prepare('SELECT coverImagePath FROM projects WHERE id = ?').get(projectId) as { coverImagePath: string | null };
    if (!proj.coverImagePath) {
      const first = db.prepare('SELECT filePath FROM project_images WHERE projectId = ? ORDER BY sortOrder LIMIT 1').get(projectId) as { filePath: string };
      if (first) {
        db.prepare('UPDATE projects SET coverImagePath = ? WHERE id = ?').run(first.filePath, projectId);
      }
    }

    const count = (db.prepare('SELECT COUNT(*) as c FROM project_images WHERE projectId = ?').get(projectId) as { c: number }).c;
    const now = Date.now();

    reorderProjectImagesByFilename(projectId);

    db.prepare(`
      UPDATE projects SET frameCount = ?, frameWidth = ?, frameHeight = ?, updatedAt = ?
      WHERE id = ?
    `).run(count, width, height, now, projectId);

    const rows = db.prepare('SELECT * FROM project_images WHERE projectId = ? ORDER BY sortOrder ASC').all(projectId) as Parameters<typeof mapProjectImage>[0][];
    const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Parameters<typeof mapProject>[0];
    res.status(201).json({
      images: rows.map(mapProjectImage),
      project: mapProject(updatedProject),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload validation failed';
    res.status(400).json({ error: message });
  }
});

app.patch('/api/images/:id', (req, res) => {
  const db = getDb();
  const imageId = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM project_images WHERE id = ?').get(imageId);
  if (!existing) return res.status(404).json({ error: 'Image not found' });

  if ('isSelected' in req.body) {
    db.prepare('UPDATE project_images SET isSelected = ? WHERE id = ?').run(req.body.isSelected ? 1 : 0, imageId);
  }
  if ('sortOrder' in req.body) {
    db.prepare('UPDATE project_images SET sortOrder = ? WHERE id = ?').run(req.body.sortOrder, imageId);
  }

  const row = db.prepare('SELECT * FROM project_images WHERE id = ?').get(imageId) as Parameters<typeof mapProjectImage>[0];
  res.json(mapProjectImage(row));
});

app.delete('/api/images/:id', (req, res) => {
  const db = getDb();
  const imageId = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM project_images WHERE id = ?').get(imageId) as { projectId: number; filePath: string } | undefined;
  if (!existing) return res.status(404).json({ error: 'Image not found' });

  deleteFileIfExists(existing.filePath);
  db.prepare('DELETE FROM project_images WHERE id = ?').run(imageId);

  const remaining = db.prepare('SELECT * FROM project_images WHERE projectId = ? ORDER BY sortOrder ASC').all(existing.projectId) as { id: number }[];
  remaining.forEach((img, i) => {
    db.prepare('UPDATE project_images SET sortOrder = ? WHERE id = ?').run(i, img.id);
  });

  const count = remaining.length;
  db.prepare('UPDATE projects SET frameCount = ?, updatedAt = ? WHERE id = ?').run(count, Date.now(), existing.projectId);

  res.json({ ok: true });
});

app.post('/api/projects/:id/images/sort-by-name', (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  reorderProjectImagesByFilename(projectId);
  db.prepare('UPDATE projects SET updatedAt = ? WHERE id = ?').run(Date.now(), projectId);

  const rows = db.prepare('SELECT * FROM project_images WHERE projectId = ? ORDER BY sortOrder ASC').all(projectId) as Parameters<typeof mapProjectImage>[0][];
  res.json(rows.map(mapProjectImage));
});

app.post('/api/projects/:id/images/select-all', (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  const selected = req.body.selected ? 1 : 0;
  db.prepare('UPDATE project_images SET isSelected = ? WHERE projectId = ?').run(selected, projectId);
  const rows = db.prepare('SELECT * FROM project_images WHERE projectId = ? ORDER BY sortOrder ASC').all(projectId) as Parameters<typeof mapProjectImage>[0][];
  res.json(rows.map(mapProjectImage));
});

app.post('/api/projects/:id/images/swap', (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  const { imageIdA, sortOrderA, imageIdB, sortOrderB } = req.body;

  db.prepare('UPDATE project_images SET sortOrder = ? WHERE id = ?').run(sortOrderB, imageIdA);
  db.prepare('UPDATE project_images SET sortOrder = ? WHERE id = ?').run(sortOrderA, imageIdB);

  const rows = db.prepare('SELECT * FROM project_images WHERE projectId = ? ORDER BY sortOrder ASC').all(projectId) as Parameters<typeof mapProjectImage>[0][];
  res.json(rows.map(mapProjectImage));
});

// --- Sheets ---
app.get('/api/projects/:id/sheets', (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  const rows = db.prepare('SELECT * FROM project_sheets WHERE projectId = ? ORDER BY version DESC').all(projectId) as Parameters<typeof mapProjectSheet>[0][];
  res.json(rows.map(mapProjectSheet));
});

app.post(
  '/api/projects/:id/sheets',
  uploadSpriteSheet.fields([
    { name: 'sheet', maxCount: 1 },
    { name: 'reverse', maxCount: 1 },
  ]),
  (req, res) => {
  const db = getDb();
  const projectId = parseInt(req.params.id, 10);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Parameters<typeof mapProject>[0] | undefined;
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const files = req.files as { sheet?: Express.Multer.File[]; reverse?: Express.Multer.File[] } | undefined;
  const file = files?.sheet?.[0];
  const reverseFile = files?.reverse?.[0];
  if (!file) return res.status(400).json({ error: 'No sheet file provided. Use multipart field "sheet".' });

  const sheetWidth = parseInt(String(req.body.sheetWidth), 10);
  const sheetHeight = parseInt(String(req.body.sheetHeight), 10);
  const frameCount = parseInt(String(req.body.frameCount), 10);
  const frameWidth = parseInt(String(req.body.frameWidth), 10);
  const frameHeight = parseInt(String(req.body.frameHeight), 10);
  const fps = parseInt(String(req.body.fps ?? project.fps), 10);

  if ([sheetWidth, sheetHeight, frameCount, frameWidth, frameHeight].some((n) => Number.isNaN(n) || n <= 0)) {
    return res.status(400).json({ error: 'Invalid sheet metadata fields' });
  }

  clearProjectSheets(projectId);

  const sheetVersion = 1;
  const { absolute, relative } = sheetFilePath(projectId, sheetVersion);
  saveBuffer(file.buffer, absolute);

  let reverseRelative: string | null = null;
  if (reverseFile) {
    const reversed = reversedSheetFilePath(projectId, sheetVersion);
    saveBuffer(reverseFile.buffer, reversed.absolute);
    reverseRelative = reversed.relative;
  }

  const now = Date.now();
  db.prepare(`
    INSERT INTO project_sheets (projectId, version, filePath, reverseFilePath, sheetWidth, sheetHeight, frameCount, frameWidth, frameHeight, fps, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, sheetVersion, relative, reverseRelative, sheetWidth, sheetHeight, frameCount, frameWidth, frameHeight, fps, now);

  db.prepare(`
    UPDATE projects SET version = ?, sheetWidth = ?, sheetHeight = ?, frameCount = ?,
      frameWidth = ?, frameHeight = ?, updatedAt = ?
    WHERE id = ?
  `).run(sheetVersion, sheetWidth, sheetHeight, frameCount, frameWidth, frameHeight, now, projectId);

  const sheets = db.prepare('SELECT * FROM project_sheets WHERE projectId = ? ORDER BY version DESC').all(projectId) as Parameters<typeof mapProjectSheet>[0][];
  const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Parameters<typeof mapProject>[0];

  res.status(201).json({
    project: mapProject(updatedProject),
    sheets: sheets.map(mapProjectSheet),
  });
});

// --- Production static ---
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

async function start() {
  try {
    getDb();
    await seedDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`SQLite DB: ${path.join(process.cwd(), 'data', 'sprite-manager.db')}`);
      console.log(`Uploads: ${UPLOADS_DIR}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
