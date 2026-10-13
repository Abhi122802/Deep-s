import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from './env.js';

const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  console.log('[Upload] Cloudinary configured successfully.');
} else {
  console.log('[Upload] Cloudinary credentials not detected in .env. Using local uploads directory with static serving.');
}

// Ensure local uploads directory exists for fallback
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer in-memory storage for processing and upload
const memoryStorage = multer.memoryStorage();

// File filter: accept images only with valid MIME types and matching extensions
const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only JPEG, PNG, and WEBP image files with valid extensions (.jpg, .jpeg, .png, .webp) are accepted.'));
  }
};

export const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Upload image buffer to Cloudinary if configured, otherwise save to local disk
 */
export async function uploadImageBuffer(
  file: Express.Multer.File,
  folder = 'deeps_custom_cakes'
): Promise<UploadResult> {
  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          allowed_formats: ['jpg', 'png', 'webp', 'jpeg'],
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error('Cloudinary upload returned empty response'));
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
      );
      uploadStream.end(file.buffer);
    });
  }

  // Fallback: Save to local disk
  const safeFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${path.extname(file.originalname) || '.jpg'}`;
  const localFilePath = path.join(UPLOADS_DIR, safeFilename);
  await fs.promises.writeFile(localFilePath, file.buffer);

  return {
    url: `/uploads/${safeFilename}`,
    publicId: `local-${safeFilename}`,
  };
}
