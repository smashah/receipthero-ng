import { describe, test, expect, beforeAll } from 'bun:test';
import { app } from '../index';

describe('Health Route', () => {
  test('GET /api/health returns health status', async () => {
    const res = await app.request('/api/health');
    const data = await res.json() as any;

    expect(res.status).toBeOneOf([200, 503]);
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('checks');
    expect(data.checks).toHaveProperty('paperlessConnection');
    expect(data.checks).toHaveProperty('togetherAiConnection');
    expect(data.checks).toHaveProperty('config');
  });
});
