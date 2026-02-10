import { describe, test, expect, beforeAll } from 'bun:test';
import app from '../index';

describe('Health Route', () => {
  test('GET /api/health returns health status', async () => {
    const res = await app.request('/api/health');
    const data = await res.json() as Record<string, unknown>;

    expect(res.status).toBeOneOf([200, 503]);
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('checks');
    const checks = data.checks as Record<string, unknown>;
    expect(checks).toHaveProperty('paperlessConnection');
    expect(checks).toHaveProperty('aiConnection');
    expect(checks).toHaveProperty('config');
  });
});
