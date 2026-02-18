import { describe, it, expect, mock } from 'bun:test';
import { extractWithSchema } from '../services/extract';

// Mock the TanStack AI chat function
mock.module('@tanstack/ai', () => ({
  chat: async ({ outputSchema, messages }: any) => {
    // Basic mock response matching the wrapped schema structure
    return {
      items: [
        {
          vendor: 'Test Store',
          amount: 12.34,
          date: '2024-01-01'
        }
      ]
    };
  }
}));

describe('extractWithSchema', () => {
  const mockAdapter = {} as any;
  const mockImage = 'data:image/jpeg;base64,mock';
  const mockJsonSchema = {
    type: 'object',
    properties: {
      vendor: { type: 'string' },
      amount: { type: 'number' },
      date: { type: 'string' }
    },
    required: ['vendor', 'amount', 'date']
  };

  it('should extract data correctly using a JSON Schema', async () => {
    const result = await extractWithSchema(
      mockImage,
      mockJsonSchema,
      'Test instructions',
      mockAdapter
    );

    expect(result).toHaveLength(1);
    expect(result[0].vendor).toBe('Test Store');
    expect(result[0].amount).toBe(12.34);
    expect(result[0].date).toBe('2024-01-01');
  });
});
