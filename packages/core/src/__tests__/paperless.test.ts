import { afterEach, describe, expect, it, mock } from 'bun:test';
import { PaperlessClient } from '../services/paperless';

describe('PaperlessClient.getUnprocessedDocuments', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  it('returns no documents when the configured receipt tag is missing', async () => {
    const fetchMock = mock(async () => {
      return new Response(
        JSON.stringify({
          results: [{ id: 10, name: 'ai-processed' }],
          next: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new PaperlessClient({
      host: 'http://paperless.local',
      apiKey: 'test-key',
      processedTagName: 'ai-processed',
    });

    const documents = await client.getUnprocessedDocuments({
      receiptTagName: 'receipt',
    });

    expect(documents).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('filters documents by receipt tag when the tag exists', async () => {
    const fetchMock = mock(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.endsWith('/api/tags/')) {
        return new Response(
          JSON.stringify({
            results: [
              { id: 1, name: 'receipt' },
              { id: 2, name: 'ai-processed' },
            ],
            next: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          results: [{ id: 99, title: 'Receipt 99' }],
          next: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new PaperlessClient({
      host: 'http://paperless.local',
      apiKey: 'test-key',
      processedTagName: 'ai-processed',
    });

    const documents = await client.getUnprocessedDocuments({
      receiptTagName: 'receipt',
    });

    expect(documents).toEqual([{ id: 99, title: 'Receipt 99' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/documents/?tags__id__all=1&tags__id__none=2');
  });
});
