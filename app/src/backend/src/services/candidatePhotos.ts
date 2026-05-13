import sharp from 'sharp';

export const ONE_INCH_PHOTO_WIDTH = 295;
export const ONE_INCH_PHOTO_HEIGHT = 413;
export const MAX_CANDIDATE_PHOTO_BYTES = 100 * 1024;

export class CandidatePhotoError extends Error {
  code = 'CANDIDATE_PHOTO_INVALID';
  statusCode = 400;
}

export interface ProcessedCandidatePhoto {
  buffer: Buffer;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  size: number;
}

export async function processCandidatePhoto(input: Buffer): Promise<ProcessedCandidatePhoto> {
  let image: sharp.Sharp;
  try {
    image = sharp(input, { failOn: 'error' }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new CandidatePhotoError('照片文件无法识别');
    }
    if (metadata.width < 120 || metadata.height < 160) {
      throw new CandidatePhotoError('照片像素过低，请上传更清晰的一寸照');
    }
  } catch (err) {
    if (err instanceof CandidatePhotoError) throw err;
    throw new CandidatePhotoError('照片文件无法识别');
  }

  for (const quality of [86, 78, 70, 62, 54, 46, 38]) {
    const buffer = await image
      .clone()
      .resize(ONE_INCH_PHOTO_WIDTH, ONE_INCH_PHOTO_HEIGHT, { fit: 'cover', position: 'centre' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (buffer.length <= MAX_CANDIDATE_PHOTO_BYTES) {
      return {
        buffer,
        mimeType: 'image/jpeg',
        width: ONE_INCH_PHOTO_WIDTH,
        height: ONE_INCH_PHOTO_HEIGHT,
        size: buffer.length,
      };
    }
  }

  throw new CandidatePhotoError('照片压缩后仍超过100KB，请更换更清晰简洁的证件照背景');
}
