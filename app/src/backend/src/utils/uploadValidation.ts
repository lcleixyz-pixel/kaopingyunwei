import path from 'node:path';
import type { Request } from 'express';
import { AppError } from './friendlyErrors.js';

export type UploadFileLike = {
  originalname?: string;
  mimetype?: string;
};

export type UploadProfile = {
  allowedExts: readonly string[];
  allowedMimes: readonly string[];
  typeLabel: string;
};

export const uploadProfiles = {
  spreadsheet: {
    allowedExts: ['.xls', '.xlsx'],
    allowedMimes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    typeLabel: 'XLS/XLSX',
  },
  photo: {
    allowedExts: ['.jpg', '.jpeg', '.png'],
    allowedMimes: ['image/jpeg', 'image/png'],
    typeLabel: 'JPG/PNG',
  },
  signedAttachment: {
    allowedExts: ['.pdf', '.jpg', '.jpeg', '.png'],
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/png'],
    typeLabel: 'PDF/JPG/PNG',
  },
} as const satisfies Record<string, UploadProfile>;

export function validateUploadFile(file: UploadFileLike, profile: UploadProfile, fieldLabel: string): void {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  if (!profile.allowedExts.includes(ext) || !profile.allowedMimes.includes(mime)) {
    throw new AppError('INVALID_FILE_TYPE', `${fieldLabel}仅支持 ${profile.typeLabel}`, 400);
  }
}

export function createUploadFileFilter(profile: UploadProfile, fieldLabel: string) {
  return (_req: Request, file: UploadFileLike, callback: (error: Error | null, acceptFile?: boolean) => void): void => {
    try {
      validateUploadFile(file, profile, fieldLabel);
      callback(null, true);
    } catch (err) {
      callback(err as Error);
    }
  };
}
