import Dexie, { type Table } from 'dexie';

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
  coverImage?: string; // base64 data url
  version: number;
  status: 'active' | 'archived';
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  sheetWidth: number;
  sheetHeight: number;
  fps: number;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectImage {
  id?: number;
  projectId: number;
  imageSrc: string; // base64 PNG data url
  fileName: string;
  sortOrder: number;
  isSelected: boolean;
}

export interface ProjectSheet {
  id?: number;
  projectId: number;
  version: number;
  sheetSrc: string; // base64 PNG data url
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

class SpriteSheetDatabase extends Dexie {
  categories!: Table<Category, number>;
  projects!: Table<Project, number>;
  tags!: Table<Tag, number>;
  projectImages!: Table<ProjectImage, number>;
  projectSheets!: Table<ProjectSheet, number>;
  projectTags!: Table<ProjectTagJoin, number>;

  constructor() {
    super('SpriteSheetDatabase');
    this.version(1).stores({
      categories: '++id, &name',
      projects: '++id, name, categoryId, status, isFavorite, updatedAt, createdAt',
      tags: '++id, &name',
      projectImages: '++id, projectId, sortOrder',
      projectSheets: '++id, projectId, version',
      projectTags: '++id, projectId, tagName, [projectId+tagName]'
    });
  }
}

export const db = new SpriteSheetDatabase();

// Programmatically draw pixel art animations on Canvas and return Base64 PNGs
function generateSpinningCoinFrames(): string[] {
  const frames: string[] = [];
  const size = 64;

  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Background transparent
    ctx.clearRect(0, 0, size, size);

    // Calculate coin width based on frame
    const angle = (i / 6) * Math.PI;
    const ellipseWidth = Math.max(4, Math.abs(Math.cos(angle)) * 44);
    const height = 44;

    ctx.save();
    ctx.translate(size / 2, size / 2);

    // Coin face shadows
    ctx.fillStyle = '#b58900'; // Dark gold
    ctx.beginPath();
    ctx.ellipse(0, 0, ellipseWidth / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner rim
    ctx.fillStyle = '#ebcb8b'; // Soft yellow-gold
    ctx.beginPath();
    ctx.ellipse(0, 0, (ellipseWidth * 0.8) / 2, (height * 0.8) / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Secondary shading
    ctx.fillStyle = '#d08770'; // Orange copper shading
    ctx.beginPath();
    ctx.ellipse(-2, -2, (ellipseWidth * 0.4) / 2, (height * 0.4) / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Coin Detail Star
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 0, (ellipseWidth * 0.2) / 2, (height * 0.2) / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Specular Highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-ellipseWidth / 4, -height / 4, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    frames.push(canvas.toDataURL('image/png'));
  }
  return frames;
}

function generateFireballFrames(): string[] {
  const frames: string[] = [];
  const size = 64;

  const colors = [
    ['#bf616a', '#d08770', '#ebcb8b'], // red orange yellow
    ['#bf616a', '#d08770', '#ebcb8b'],
    ['#88c0d0', '#5e81ac', '#ebcb8b'], // turning smoke gray + sparks
    ['#4c566a', '#d08770', '#ebcb8b'],
    ['#4c566a', '#3b4252', '#d08770'],
    ['#3b4252', '#2e3440', '#4c566a'],
  ];

  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.clearRect(0, 0, size, size);

    const stageColors = colors[i];
    const center = size / 2;
    // Core expansion
    const radius = 8 + i * 5;

    if (i < 4) {
      // Draw secondary trail
      ctx.fillStyle = stageColors[0];
      ctx.beginPath();
      ctx.arc(center + 2, center + 4, radius * 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Middle trail
      ctx.fillStyle = stageColors[1];
      ctx.beginPath();
      ctx.arc(center - 1, center - 2, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Core glow
      ctx.fillStyle = stageColors[2] || '#ffffff';
      ctx.beginPath();
      ctx.arc(center, center, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Sparks
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
      // Smoke puff circles
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

      // tiny embers
      ctx.fillStyle = stageColors[2] || '#d08770';
      ctx.fillRect(center - 10, center + 10, 2, 2);
      ctx.fillRect(center + 12, center - 8, 2, 2);
    }

    frames.push(canvas.toDataURL('image/png'));
  }
  return frames;
}

function generateBubblePulseFrames(): string[] {
  const frames: string[] = [];
  const size = 64;

  for (let i = 0; i < 4; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.clearRect(0, 0, size, size);
    const center = size / 2;

    // Bubble radius pulsing up and down
    const radius = 18 + Math.sin((i / 4) * Math.PI * 2) * 4;

    ctx.save();
    ctx.translate(center, center);

    // Aqua outer rim
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner bright teal filling
    ctx.fillStyle = 'rgba(129, 140, 248, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
    ctx.fill();

    // White highlight shine (typical of 2D bubbles)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-radius * 0.4, -radius * 0.4, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    frames.push(canvas.toDataURL('image/png'));
  }
  return frames;
}

// Generates an actual stitched sprite sheet horizontally for database entry
async function stitchHorizontalSheet(frameSrcs: string[], width: number, height: number): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width * frameSrcs.length;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve('');
      return;
    }

    let loadedCount = 0;
    const images = frameSrcs.map((src, index) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === frameSrcs.length) {
          // Draw all in ordered sequence
          images.forEach((loadedImg, i) => {
            ctx.drawImage(loadedImg, i * width, 0, width, height);
          });
          resolve(canvas.toDataURL('image/png'));
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === frameSrcs.length) {
          resolve('');
        }
      };
      img.src = src;
      return img;
    });
  });
}

// Seed the database with modern starter elements
export async function seedDatabase() {
  const categoryCount = await db.categories.count();
  if (categoryCount > 0) return; // already database seeded

  // Seed standard categories
  const categoriesToSeed = [
    'Characters',
    'Effects',
    'Environment',
    'UI',
    'Items',
    'Weapons',
    'Enemies'
  ];
  
  const categoryIds: Record<string, number> = {};
  for (const catName of categoriesToSeed) {
    const id = await db.categories.add({ name: catName });
    categoryIds[catName] = id;
  }

  // Seed tags
  const tagsToSeed = ['coin', 'item', 'gold', 'fire', 'explosion', 'fx', 'bubble', 'water', 'shield', 'run', 'pixel-art'];
  for (const tagName of tagsToSeed) {
    try {
      await db.tags.add({ name: tagName });
    } catch {
      // Ignored for duplicates
    }
  }

  // 1. SPINNING COIN SEED
  const coinFrames = generateSpinningCoinFrames();
  const coinSheetSrc = await stitchHorizontalSheet(coinFrames, 64, 64);
  const now = Date.now();

  const coinProjId = await db.projects.add({
    name: 'Spinning Gold Coin',
    description: 'A 6-frame classic pixel art rotating coin animations loop for UI or item pickups.',
    categoryId: categoryIds['Items'],
    coverImage: coinFrames[0],
    version: 1,
    status: 'active',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 6,
    sheetWidth: 384,
    sheetHeight: 64,
    fps: 10,
    isFavorite: true,
    createdAt: now - 3600000 * 2, // 2 hr ago
    updatedAt: now - 3600000 * 2,
  });

  // Add tags
  for (const tag of ['coin', 'item', 'gold', 'pixel-art']) {
    await db.projectTags.add({ projectId: coinProjId, tagName: tag });
  }

  // Add frame images
  for (let i = 0; i < coinFrames.length; i++) {
    await db.projectImages.add({
      projectId: coinProjId,
      imageSrc: coinFrames[i],
      fileName: `coin_frame_${i + 1}.png`,
      sortOrder: i,
      isSelected: true
    });
  }

  // Save generated sprite sheet v1
  await db.projectSheets.add({
    projectId: coinProjId,
    version: 1,
    sheetSrc: coinSheetSrc,
    sheetWidth: 384,
    sheetHeight: 64,
    frameCount: 6,
    frameWidth: 64,
    frameHeight: 64,
    fps: 10,
    createdAt: now - 3600000 * 2,
  });


  // 2. FIREBALL EXPLOSION SEED
  const fireballFrames = generateFireballFrames();
  const fireballSheetSrc = await stitchHorizontalSheet(fireballFrames, 64, 64);

  const fbProjId = await db.projects.add({
    name: 'Fireball Orb Explosion',
    description: 'An explosive 6-frame particle flame animation set tailored for magic bursts or wizard attack projectiles.',
    categoryId: categoryIds['Effects'],
    coverImage: fireballFrames[0],
    version: 1,
    status: 'active',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 6,
    sheetWidth: 384,
    sheetHeight: 64,
    fps: 12,
    isFavorite: true,
    createdAt: now - 3600000 * 5, // 5 hours ago
    updatedAt: now - 3600000 * 5,
  });

  for (const tag of ['fire', 'explosion', 'fx', 'pixel-art']) {
    await db.projectTags.add({ projectId: fbProjId, tagName: tag });
  }

  for (let i = 0; i < fireballFrames.length; i++) {
    await db.projectImages.add({
      projectId: fbProjId,
      imageSrc: fireballFrames[i],
      fileName: `fireball_${i + 1}.png`,
      sortOrder: i,
      isSelected: true
    });
  }

  await db.projectSheets.add({
    projectId: fbProjId,
    version: 1,
    sheetSrc: fireballSheetSrc,
    sheetWidth: 384,
    sheetHeight: 64,
    frameCount: 6,
    frameWidth: 64,
    frameHeight: 64,
    fps: 12,
    createdAt: now - 3600000 * 5,
  });


  // 3. OCEAN BUBBLE PULSE SEED
  const bubbleFrames = generateBubblePulseFrames();
  const bubbleSheetSrc = await stitchHorizontalSheet(bubbleFrames, 64, 64);

  const bubbleProjId = await db.projects.add({
    name: 'Ocean Bubble Pulse',
    description: 'Ambient aquatic water bubbles with reflection glows. Great for underwater environments or water spells.',
    categoryId: categoryIds['Environment'],
    coverImage: bubbleFrames[0],
    version: 1,
    status: 'active',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 4,
    sheetWidth: 256,
    sheetHeight: 64,
    fps: 8,
    isFavorite: false,
    createdAt: now - 3600000 * 24, // 1 day ago
    updatedAt: now - 3600000 * 24,
  });

  for (const tag of ['bubble', 'water', 'pixel-art']) {
    await db.projectTags.add({ projectId: bubbleProjId, tagName: tag });
  }

  for (let i = 0; i < bubbleFrames.length; i++) {
    await db.projectImages.add({
      projectId: bubbleProjId,
      imageSrc: bubbleFrames[i],
      fileName: `bubble_burst_${i + 1}.png`,
      sortOrder: i,
      isSelected: true
    });
  }

  await db.projectSheets.add({
    projectId: bubbleProjId,
    version: 1,
    sheetSrc: bubbleSheetSrc,
    sheetWidth: 256,
    sheetHeight: 64,
    frameCount: 4,
    frameWidth: 64,
    frameHeight: 64,
    fps: 8,
    createdAt: now - 3600000 * 24,
  });
}
