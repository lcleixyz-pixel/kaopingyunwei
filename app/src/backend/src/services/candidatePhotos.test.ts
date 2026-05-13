import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { processCandidatePhoto, ONE_INCH_PHOTO_HEIGHT, ONE_INCH_PHOTO_WIDTH } from './candidatePhotos.js';

describe('candidate photo processing', () => {
  it('crops uploaded photos to one-inch JPEG output under 100KB', async () => {
    const input = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: '#1d4ed8',
      },
    })
      .png()
      .toBuffer();

    const processed = await processCandidatePhoto(input);
    const metadata = await sharp(processed.buffer).metadata();

    assert.equal(processed.mimeType, 'image/jpeg');
    assert.equal(metadata.width, ONE_INCH_PHOTO_WIDTH);
    assert.equal(metadata.height, ONE_INCH_PHOTO_HEIGHT);
    assert.ok(processed.buffer.length <= 100 * 1024);
  });

  it('rejects invalid image payloads', async () => {
    await assert.rejects(
      () => processCandidatePhoto(Buffer.from('not an image')),
      /照片文件无法识别/,
    );
  });
});
