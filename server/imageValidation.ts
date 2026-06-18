import sizeOf from 'image-size';

export function getImageDimensions(buffer: Buffer): { width: number; height: number } {
  const dim = sizeOf(buffer);
  if (!dim.width || !dim.height) {
    throw new Error('Could not read image dimensions');
  }
  return { width: dim.width, height: dim.height };
}
