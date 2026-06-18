import { createCanvas, Image } from 'canvas';

/** Flip each frame horizontally while preserving frame order (right-facing → left-facing). */
export function flipSheetFramesHorizontally(
  sourceBuffer: Buffer,
  sheetWidth: number,
  sheetHeight: number,
  frameWidth: number,
  frameCount: number
): Buffer {
  const canvas = createCanvas(sheetWidth, sheetHeight);
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = sourceBuffer;

  for (let i = 0; i < frameCount; i++) {
    ctx.save();
    ctx.translate((i + 1) * frameWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, i * frameWidth, 0, frameWidth, sheetHeight, 0, 0, frameWidth, sheetHeight);
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}
