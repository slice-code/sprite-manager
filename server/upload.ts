import multer from 'multer';

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

function isImageFile(file: Express.Multer.File): boolean {
  return IMAGE_MIMES.has(file.mimetype) || IMAGE_EXT.test(file.originalname);
}

export const uploadFrameImages = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (isImageFile(file)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, or WEBP images are allowed'));
    }
  },
});

export const uploadSpriteSheet = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (_req, file, cb) => {
    if (isImageFile(file)) {
      cb(null, true);
    } else {
      cb(new Error('Sprite sheet must be a PNG, JPG, or WEBP image'));
    }
  },
});
