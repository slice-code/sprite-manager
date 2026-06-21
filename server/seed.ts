import { createCanvas, Image } from 'canvas';
import { getDb, isDatabaseEmpty } from './database.js';
import {
  ensureProjectDirs,
  saveBuffer,
  sheetFilePath,
  reversedSheetFilePath,
  toRelativePath,
  compressPngBuffer,
} from './storage.js';
import { flipSheetFramesHorizontally } from './imageFlip.js';
import path from 'path';
import { UPLOADS_DIR } from './database.js';

function generateSpinningCoinFrames(): Buffer[] {
  const frames: Buffer[] = [];
  const size = 64;

  for (let i = 0; i < 6; i++) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    const angle = (i / 6) * Math.PI;
    const ellipseWidth = Math.max(4, Math.abs(Math.cos(angle)) * 44);
    const height = 44;

    ctx.save();
    ctx.translate(size / 2, size / 2);

    ctx.fillStyle = '#b58900';
    ctx.beginPath();
    ctx.ellipse(0, 0, ellipseWidth / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ebcb8b';
    ctx.beginPath();
    ctx.ellipse(0, 0, (ellipseWidth * 0.8) / 2, (height * 0.8) / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d08770';
    ctx.beginPath();
    ctx.ellipse(-2, -2, (ellipseWidth * 0.4) / 2, (height * 0.4) / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 0, (ellipseWidth * 0.2) / 2, (height * 0.2) / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-ellipseWidth / 4, -height / 4, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    frames.push(canvas.toBuffer('image/png'));
  }
  return frames;
}

function generateFireballFrames(): Buffer[] {
  const frames: Buffer[] = [];
  const size = 64;

  const colors = [
    ['#bf616a', '#d08770', '#ebcb8b'],
    ['#bf616a', '#d08770', '#ebcb8b'],
    ['#88c0d0', '#5e81ac', '#ebcb8b'],
    ['#4c566a', '#d08770', '#ebcb8b'],
    ['#4c566a', '#3b4252', '#d08770'],
    ['#3b4252', '#2e3440', '#4c566a'],
  ];

  for (let i = 0; i < 6; i++) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    const stageColors = colors[i];
    const center = size / 2;
    const radius = 8 + i * 5;

    if (i < 4) {
      ctx.fillStyle = stageColors[0];
      ctx.beginPath();
      ctx.arc(center + 2, center + 4, radius * 1.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = stageColors[1];
      ctx.beginPath();
      ctx.arc(center - 1, center - 2, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = stageColors[2] || '#ffffff';
      ctx.beginPath();
      ctx.arc(center, center, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      const sparkCount = 8 - i;
      for (let s = 0; s < sparkCount; s++) {
        const angle = (s / sparkCount) * Math.PI * 2 + i;
        const dist = radius * (1.2 + Math.random() * 0.3);
        const sx = center + Math.cos(angle) * dist;
        const sy = center + Math.sin(angle) * dist;
        ctx.fillRect(Math.floor(sx), Math.floor(sy), 3, 3);
      }
    } else {
      ctx.fillStyle = stageColors[0];
      ctx.beginPath();
      ctx.arc(center - 6, center - 4, 8, 0, Math.PI * 2);
      ctx.arc(center + 6, center + 2, 7, 0, Math.PI * 2);
      ctx.arc(center, center - 5, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = stageColors[1];
      ctx.beginPath();
      ctx.arc(center - 2, center - 1, 6, 0, Math.PI * 2);
      ctx.arc(center + 2, center - 3, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = stageColors[2] || '#d08770';
      ctx.fillRect(center - 10, center + 10, 2, 2);
      ctx.fillRect(center + 12, center - 8, 2, 2);
    }

    frames.push(canvas.toBuffer('image/png'));
  }
  return frames;
}

function generateBubblePulseFrames(): Buffer[] {
  const frames: Buffer[] = [];
  const size = 64;

  for (let i = 0; i < 4; i++) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const center = size / 2;
    const radius = 18 + Math.sin((i / 4) * Math.PI * 2) * 4;

    ctx.save();
    ctx.translate(center, center);

    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(129, 140, 248, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-radius * 0.4, -radius * 0.4, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    frames.push(canvas.toBuffer('image/png'));
  }
  return frames;
}

function stitchGridSheet(frameBuffers: Buffer[], width: number, height: number): Buffer {
  const cols = 4;
  const rows = Math.max(4, Math.ceil(frameBuffers.length / cols));
  const canvas = createCanvas(width * cols, height * rows);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  frameBuffers.forEach((buf, i) => {
    const img = new Image();
    img.src = buf;
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.drawImage(img, col * width, row * height, width, height);
  });
  return canvas.toBuffer('image/png', { compressionLevel: 9 });
}

async function saveFramesAndProject(
  name: string,
  description: string,
  categoryId: number,
  tags: string[],
  frameBuffers: Buffer[],
  fileNames: string[],
  fps: number,
  isFavorite: boolean,
  createdOffsetMs: number
) {
  const db = getDb();
  const now = Date.now() - createdOffsetMs;
  const frameWidth = 64;
  const frameHeight = 64;
  const frameCount = frameBuffers.length;

  const cols = 4;
  const rows = Math.max(4, Math.ceil(frameCount / cols));
  const sheetWidth = frameWidth * cols;
  const sheetHeight = frameHeight * rows;

  const insertProject = db.prepare(`
    INSERT INTO projects (name, description, categoryId, coverImagePath, version, status,
      frameWidth, frameHeight, frameCount, sheetWidth, sheetHeight, fps, isFavorite, createdAt, updatedAt)
    VALUES (?, ?, ?, NULL, 1, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const projectId = insertProject.run(
    name,
    description,
    categoryId,
    frameWidth,
    frameHeight,
    frameCount,
    sheetWidth,
    sheetHeight,
    fps,
    isFavorite ? 1 : 0,
    now,
    now
  ).lastInsertRowid as number;

  ensureProjectDirs(projectId);

  let coverPath: string | null = null;
  const savedFramePaths: Buffer[] = [];

  for (let i = 0; i < frameBuffers.length; i++) {
    const rel = `projects/${projectId}/frames/${fileNames[i]}`;
    const abs = path.join(UPLOADS_DIR, rel);
    saveBuffer(frameBuffers[i], abs);
    savedFramePaths.push(frameBuffers[i]);
    if (i === 0) coverPath = rel;

    db.prepare(`
      INSERT INTO project_images (projectId, filePath, fileName, sortOrder, isSelected)
      VALUES (?, ?, ?, ?, 1)
    `).run(projectId, rel, fileNames[i], i);
  }

  const sheetBufferRaw = stitchGridSheet(savedFramePaths, frameWidth, frameHeight);
  const sheetBuffer = await compressPngBuffer(sheetBufferRaw);
  const { absolute: sheetAbs, relative: sheetRel } = sheetFilePath(projectId, 1);
  saveBuffer(sheetBuffer, sheetAbs);

  const reverseBufferRaw = flipSheetFramesHorizontally(
    sheetBuffer,
    sheetWidth,
    sheetHeight,
    frameWidth,
    frameCount
  );
  const reverseBuffer = await compressPngBuffer(reverseBufferRaw);
  const { absolute: reverseAbs, relative: reverseRel } = reversedSheetFilePath(projectId, 1);
  saveBuffer(reverseBuffer, reverseAbs);

  db.prepare(`
    UPDATE projects SET coverImagePath = ?, version = 1, sheetWidth = ?, sheetHeight = ?, updatedAt = ?
    WHERE id = ?
  `).run(coverPath, sheetWidth, sheetHeight, now, projectId);

  db.prepare(`
    INSERT INTO project_sheets (projectId, version, filePath, reverseFilePath, sheetWidth, sheetHeight, frameCount, frameWidth, frameHeight, fps, createdAt)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, sheetRel, reverseRel, sheetWidth, sheetHeight, frameCount, frameWidth, frameHeight, fps, now);

  for (const tag of tags) {
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tag);
    db.prepare('INSERT INTO project_tags (projectId, tagName) VALUES (?, ?)').run(projectId, tag);
  }

  return projectId;
}

export async function seedDatabase(): Promise<{ seeded: boolean }> {
  if (!isDatabaseEmpty()) {
    return { seeded: false };
  }

  const db = getDb();

  const categories = [
    'Characters', 'Effects', 'Environment', 'UI', 'Items', 'Weapons', 'Enemies',
  ];
  const categoryIds: Record<string, number> = {};
  const insertCat = db.prepare('INSERT INTO categories (name) VALUES (?)');
  for (const catName of categories) {
    const result = insertCat.run(catName);
    categoryIds[catName] = Number(result.lastInsertRowid);
  }

  const tagsToSeed = ['coin', 'item', 'gold', 'fire', 'explosion', 'fx', 'bubble', 'water', 'shield', 'run', 'pixel-art'];
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  for (const tagName of tagsToSeed) {
    insertTag.run(tagName);
  }

  const coinFrames = generateSpinningCoinFrames();
  await saveFramesAndProject(
    'Spinning Gold Coin',
    'A 6-frame classic pixel art rotating coin animations loop for UI or item pickups.',
    categoryIds['Items'],
    ['coin', 'item', 'gold', 'pixel-art'],
    coinFrames,
    coinFrames.map((_, i) => `coin_frame_${i + 1}.png`),
    10,
    true,
    3600000 * 2
  );

  const fireballFrames = generateFireballFrames();
  await saveFramesAndProject(
    'Fireball Orb Explosion',
    'An explosive 6-frame particle flame animation set tailored for magic bursts or wizard attack projectiles.',
    categoryIds['Effects'],
    ['fire', 'explosion', 'fx', 'pixel-art'],
    fireballFrames,
    fireballFrames.map((_, i) => `fireball_${i + 1}.png`),
    12,
    true,
    3600000 * 5
  );

  const bubbleFrames = generateBubblePulseFrames();
  await saveFramesAndProject(
    'Ocean Bubble Pulse',
    'Ambient aquatic water bubbles with reflection glows. Great for underwater environments or water spells.',
    categoryIds['Environment'],
    ['bubble', 'water', 'pixel-art'],
    bubbleFrames,
    bubbleFrames.map((_, i) => `bubble_burst_${i + 1}.png`),
    8,
    false,
    3600000 * 24
  );

  return { seeded: true };
}
