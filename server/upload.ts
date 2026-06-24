import multer from 'multer';

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const ALLOWED_EXT = /\.(png|jpe?g|webp|obj|blend|fbx|gltf|glb|stl|ply|3ds|dae|mtl|tga)$/i;

function isImageFile(file: Express.Multer.File): boolean {
  return IMAGE_MIMES.has(file.mimetype) || IMAGE_EXT.test(file.originalname);
}

function isAllowedFile(file: Express.Multer.File): boolean {
  return ALLOWED_EXT.test(file.originalname);
}

export const uploadFrameImages = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (isAllowedFile(file)) {
      cb(null, true);
    } else {
      cb(new Error('Only standard images (PNG, JPG, WEBP) or 3D files (OBJ, BLEND, FBX, GLTF, GLB, STL, PLY, 3DS, DAE, MTL, TGA) are allowed'));
    }
  },
});

export const uploadSpriteSheet = multer({
  storage: multer.memoryStorage(),
  limits: {
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
