# Workspace Cleanup & @elements Installation

## @elements Installation Results
- **env-editor**: FAILED
- **json-viewer**: FAILED
- **error-boundary-ui**: FAILED

## Installation Errors
- All components failed with "Not Found" error in the shadcn registry (https://ui.shadcn.com/r/styles/base-lyra/...).
- It appears these specific components are not available in the current shadcn/ui registry or the base style "base-lyra" is not configured correctly for these components.

## Fallback Strategy
- Since the @elements components are unavailable, we will fallback to using the standard shadcn **Textarea** component.
- For JSON viewing and environment editing, we will integrate a syntax highlighting library (e.g., `shiki` or `prismjs`) to provide rich UX within the Textarea or a custom div wrapper.
- For error boundaries, we will use a standard `react-error-boundary` implementation with a custom UI component.

---

# TanStack Query Setup (Task 1)

## Installation
- Installed `@tanstack/react-query` and `@tanstack/react-query-devtools` in `apps/webapp`
- Devtools package is SEPARATE from main package - must install both

## API Client Pattern (`apps/webapp/src/lib/api.ts`)
- `API_BASE_URL` defaults to `http://localhost:3001` (API port)
- `fetchApi<T>(path, options)` wrapper with:
  - Automatic JSON Content-Type headers
  - Error extraction into `FetchError` class with status, statusText, data
  - Support for `import.meta.env.VITE_API_URL` override
- Query key factories pattern: `healthKeys.all`, `healthKeys.status()`, `configKeys.all`, `configKeys.current()`

## Query Hooks (`apps/webapp/src/lib/queries.ts`)
Five hooks implemented:
1. `useHealth()` - 30s polling with `refetchIntervalInBackground: false` (pauses when hidden)
2. `useConfig()` - Fetches masked config
3. `useSaveConfig()` - Mutation, invalidates both config and health on success
4. `useTestPaperless()` - Mutation for connection test
5. `useTestTogether()` - Mutation for AI key test

## Visibility-Based Polling
- TanStack Query's `refetchIntervalInBackground: false` automatically pauses polling when `document.visibilityState === 'hidden'`
- No manual visibility API integration needed - built into TanStack Query

## QueryClient Configuration
- Created outside component to avoid re-creation on renders
- Default options: `refetchOnWindowFocus: true`, `retry: 1`, `staleTime: 30_000`

## __root.tsx Integration
- QueryClientProvider wraps children inside `<body>`
- ReactQueryDevtools placed inside provider (only in dev - automatically stripped by `@tanstack/devtools-vite` in production)

## API Response Types Discovered
From `apps/api/src/routes/health.ts`:
```typescript
interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    paperlessConnection: 'ok' | 'error';
    togetherAiConnection: 'ok' | 'error';
    config: 'ok' | 'error';
  };
  errors?: string[];
}
```

From `packages/shared/src/schemas.ts`:
- `ConfigSchema` with `paperless`, `togetherAi`, `processing`, `rateLimit`, `observability` sections
- Type exported as `Config = z.infer<typeof ConfigSchema>`

## Build Notes
- `bun run --filter @sm-rn/webapp build` passes
- "use client" directive warnings from react-query modules are expected and harmless (bundler handles them)
