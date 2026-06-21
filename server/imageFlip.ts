import { createCanvas, Image } from 'canvas';

/** Flip each frame horizontally while preserving frame order in a grid layout (right-facing → left-facing). */
export function flipSheetFramesHorizontally(
  sourceBuffer: Buffer,
  sheetWidth: number,
  sheetHeight: number,
  frameWidth: number,
  frameCount: number
): Buffer {
  const canvas = createCanvas(sheetWidth, sheetHeight);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const img = new Image();
  img.src = sourceBuffer;

  const cols = 4;
  const rows = Math.max(4, Math.ceil(frameCount / cols));
  const frameHeight = Math.round(sheetHeight / rows);

  for (let i = 0; i < frameCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const sourceX = col * frameWidth;
    const sourceY = row * frameHeight;

    ctx.save();
    ctx.translate(sourceX + frameWidth, sourceY);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sourceX, sourceY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
    ctx.restore();
  }

  return canvas.toBuffer('image/png', { compressionLevel: 9 });
}
