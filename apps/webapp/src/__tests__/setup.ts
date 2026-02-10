import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia for components that use media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock TanStack Router - used by page components
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to, ...props }: any) =>
      React.createElement('a', { href: to, ...props }, children),
    useNavigate: () => vi.fn(),
  }
})

// Mock sonner toast for Settings page
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  Toaster: () => null,
}))

// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a fresh QueryClient for testing with disabled retries.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Wrapper component with QueryClientProvider for testing hooks/components
 * that use TanStack Query.
 */
export function createQueryWrapper() {
  const queryClient = createTestQueryClient()
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data Factories
// ─────────────────────────────────────────────────────────────────────────────

export const mockHealthData = {
  healthy: {
    status: 'healthy' as const,
    timestamp: new Date().toISOString(),
    checks: {
      paperlessConnection: 'ok' as const,
      aiConnection: 'ok' as const,
      config: 'ok' as const,
    },
    stats: {
      detected: 10,
      processed: 8,
      inQueue: 2,
    },
  },
  unhealthy: {
    status: 'unhealthy' as const,
    timestamp: new Date().toISOString(),
    checks: {
      paperlessConnection: 'error' as const,
      aiConnection: 'error' as const,
      config: 'error' as const,
    },
    stats: {
      detected: 10,
      processed: 5,
      failed: 5,
      inQueue: 5,
    },
    errors: ['Paperless connection/stats failed', 'AI API key is missing or too short'],
  },
}

export const mockConfigData = {
  default: {
    paperless: {
      host: 'http://localhost:8000',
      apiKey: '***masked***',
    },
    ai: {
      provider: 'openai-compat',
      apiKey: '***masked***',
      model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    },
    togetherAi: {
      apiKey: '***masked***',
    },
    processing: {
      scanInterval: 300000,
      receiptTag: 'receipt',
      processedTag: 'ai-processed',
      failedTag: 'ai-failed',
      skippedTag: 'ai-skipped',
      maxRetries: 3,
      retryStrategy: 'partial',
      useDocumentType: false,
      documentTypeName: 'receipt',
      updateContent: true,
      addJsonPayload: true,
      autoTag: true,
      currencyConversion: {
        enabled: false,
        targetCurrencies: ['GBP', 'USD'],
      },
    },
    rateLimit: {
      enabled: false,
      upstashUrl: '',
      upstashToken: '',
    },
    observability: {
      heliconeEnabled: false,
      heliconeApiKey: '',
    },
  },
}
