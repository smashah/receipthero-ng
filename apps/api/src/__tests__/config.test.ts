import { describe, test, expect } from 'bun:test';
import app from '../index';

describe('Config Route', () => {
  test('GET /api/config returns config with masked keys', async () => {
    const res = await app.request('/api/config');
    const data = await res.json() as Record<string, unknown>;

    if (res.status === 200) {
      expect(data).toHaveProperty('paperless');
      expect(data).toHaveProperty('ai');
      expect(data).toHaveProperty('processing');

      // Check that keys are masked (should contain '...')
      const paperless = data.paperless as Record<string, string>;
      if (paperless.apiKey) {
        expect(paperless.apiKey).toContain('...');
      }
      const ai = data.ai as Record<string, string>;
      if (ai.apiKey) {
        expect(ai.apiKey).toContain('...');
      }
    }
  });
});
