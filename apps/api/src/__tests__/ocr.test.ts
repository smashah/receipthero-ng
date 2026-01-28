import { describe, test, expect } from 'bun:test';
import app from '../index';

describe('OCR Route', () => {
  test('POST /api/ocr requires base64Image', async () => {
    const res = await app.request('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  test('POST /api/ocr accepts base64Image', async () => {
    const res = await app.request('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image: 'test' }),
    });

    // Should either succeed or fail with server error (not validation error)
    expect(res.status).toBeOneOf([200, 429, 500]);
  });
});
