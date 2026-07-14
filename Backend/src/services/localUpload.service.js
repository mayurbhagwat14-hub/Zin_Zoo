import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const generateFilename = (prefix = 'file', ext = '.webp') => {
    const timestamp = Date.now();
    const hash = crypto.randomBytes(4).toString('hex');
    return `${prefix}_${timestamp}_${hash}${ext}`;
};

export const uploadImageBuffer = async (buffer, folder = 'misc') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    const targetDir = path.join(UPLOADS_DIR, folder);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = generateFilename('img', '.webp');
    const filePath = path.join(targetDir, filename);

    await sharp(buffer)
        .resize({ width: 1200, height: 800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filePath);

    return `/uploads/${folder}/${filename}`.replace(/\\/g, '/');
};

export const uploadImageBufferDetailed = async (buffer, folder = 'misc') => {
    const url = await uploadImageBuffer(buffer, folder);
    return {
        secure_url: url,
        public_id: url
    };
};

export const uploadVideoBuffer = async (buffer, folder = 'misc') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    const targetDir = path.join(UPLOADS_DIR, folder);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = generateFilename('vid', '.mp4');
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, buffer);

    return `/uploads/${folder}/${filename}`.replace(/\\/g, '/');
};

export const uploadFileBuffer = async (buffer, folder = 'misc', options = {}) => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    const targetDir = path.join(UPLOADS_DIR, folder);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const ext = options.format ? `.${options.format}` : '.pdf';
    const rawName = options.fileName ? options.fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') : 'doc';
    
    const timestamp = Date.now();
    const hash = crypto.randomBytes(4).toString('hex');
    const filename = `${rawName}_${timestamp}_${hash}${ext}`;
    
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, buffer);

    return `/uploads/${folder}/${filename}`.replace(/\\/g, '/');
};

export const buildRawDownloadUrlFromFileUrl = (fileUrl, options = {}) => {
    if (!fileUrl) return '';
    return fileUrl;
};

export const deleteLocalFile = async (fileUrl) => {
    if (!fileUrl || typeof fileUrl !== 'string') return false;
    
    // Ensure the fileUrl actually belongs to our /uploads directory
    if (!fileUrl.includes('/uploads/')) return false;

    try {
        // Extract the path after /uploads/
        const urlParts = fileUrl.split('/uploads/');
        if (urlParts.length < 2) return false;
        
        const relativePath = urlParts[1];
        const absolutePath = path.join(UPLOADS_DIR, relativePath);

        // Prevent directory traversal attacks
        const normalizedPath = path.normalize(absolutePath);
        if (!normalizedPath.startsWith(UPLOADS_DIR)) return false;

        if (fs.existsSync(normalizedPath)) {
            fs.unlinkSync(normalizedPath);
            return true;
        }
    } catch (err) {
        console.error('Error deleting local file:', err.message);
    }
    return false;
};
