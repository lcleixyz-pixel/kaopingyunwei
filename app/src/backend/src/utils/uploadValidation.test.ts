import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from './friendlyErrors.js';
import { uploadProfiles, validateUploadFile } from './uploadValidation.js';

describe('upload file validation', () => {
  it('accepts certificate import spreadsheets by extension and MIME type', () => {
    assert.doesNotThrow(() =>
      validateUploadFile(
        {
          originalname: '证书编号.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        uploadProfiles.spreadsheet,
        '证书编号导入文件'
      )
    );
  });

  it('rejects certificate imports with spoofed extension or MIME type', () => {
    assert.throws(
      () =>
        validateUploadFile(
          {
            originalname: '证书编号.xlsx',
            mimetype: 'text/plain',
          },
          uploadProfiles.spreadsheet,
          '证书编号导入文件'
        ),
      (err) => err instanceof AppError && err.code === 'INVALID_FILE_TYPE' && /仅支持 XLS\/XLSX/.test(err.message)
    );
  });

  it('accepts candidate photos only when both extension and MIME type are image-safe', () => {
    assert.doesNotThrow(() =>
      validateUploadFile(
        {
          originalname: 'photo.png',
          mimetype: 'image/png',
        },
        uploadProfiles.photo,
        '考生照片'
      )
    );
    assert.throws(
      () =>
        validateUploadFile(
          {
            originalname: 'photo.png',
            mimetype: 'application/pdf',
          },
          uploadProfiles.photo,
          '考生照片'
        ),
      /考生照片仅支持 JPG\/PNG/
    );
  });

  it('accepts signed attachments as PDF or common image files only', () => {
    assert.doesNotThrow(() =>
      validateUploadFile(
        {
          originalname: '盖章件.pdf',
          mimetype: 'application/pdf',
        },
        uploadProfiles.signedAttachment,
        '盖章件'
      )
    );
    assert.throws(
      () =>
        validateUploadFile(
          {
            originalname: '脚本.html',
            mimetype: 'text/html',
          },
          uploadProfiles.signedAttachment,
          '盖章件'
        ),
      /盖章件仅支持 PDF\/JPG\/PNG/
    );
  });
});
