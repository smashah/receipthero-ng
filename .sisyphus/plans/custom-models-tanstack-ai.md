# Implementation Plan: Enable Custom Models (Issue #7)

**Goal:** Replace hardcoded `together-ai` SDK with TanStack AI to enable users to configure any LLM provider (Together AI, Ollama, OpenRouter, or any OpenAI-compatible endpoint).

**References:**
- GitHub Issue: https://github.com/smashah/receipthero-ng/issues/7
- TanStack AI Docs: https://tanstack.com/ai
- Research Comment: https://github.com/smashah/receipthero-ng/issues/7#issuecomment-3876382886

---

## Task 1: Update Config Schema (shared package)

**File:** `packages/shared/src/schemas.ts`
**Depends on:** Nothing (start here)

### Changes:
1. Add `ai` config section with `provider`, `apiKey`, `baseURL`, `model` fields
2. Make `togetherAi` optional for backward compatibility
3. Export `AIProvider` type

### Before:
```typescript
export const ConfigSchema = z.object({
  paperless: z.object({ ... }),
  togetherAi: z.object({
    apiKey: z.string().min(1, "TOGETHER_API_KEY is required"),
  }),
  processing: z.object({ ... }),
  // ...
});
```

### After:
```typescript
export const AIProviderSchema = z.enum(['openai-compat', 'ollama', 'openrouter']);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const ConfigSchema = z.object({
  paperless: z.object({ ... }),
  ai: z.object({
    provider: AIProviderSchema.default('openai-compat'),
    apiKey: z.string().optional(),
    baseURL: z.string().url().optional(),
    model: z.string().default('meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'),
  }),
  // Keep for backward compat — resolved in config.ts
  togetherAi: z.object({
    apiKey: z.string().min(1),
  }).optional(),
  processing: z.object({ ... }),
  // ...
});
```

### Verification:
- `bun run --filter @sm-rn/shared typecheck`

---

## Task 2: Update Config Loader (backward compat)

**File:** `apps/api/src/services/config.ts`
**Depends on:** Task 1

### Changes:
1. Add env var mappings for `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`
2. Add backward compat logic: if `togetherAi.apiKey` is set but `ai` is not, auto-populate `ai.apiKey` and `ai.baseURL`
3. Validate that `ai.apiKey` is provided when `provider` is `openai-compat` or `openrouter`

### Key Logic:
```typescript
// In the rawConfig building:
ai: {
  provider: getConfigValue(fileConfig, ['ai', 'provider'], process.env.AI_PROVIDER),
  apiKey: getConfigValue(fileConfig, ['ai', 'apiKey'], process.env.AI_API_KEY),
  baseURL: getConfigValue(fileConfig, ['ai', 'baseURL'], process.env.AI_BASE_URL),
  model: getConfigValue(fileConfig, ['ai', 'model'], process.env.AI_MODEL),
},
togetherAi: {
  apiKey: getConfigValue(fileConfig, ['togetherAi', 'apiKey'], process.env.TOGETHER_API_KEY),
},

// After Zod parse, apply backward compat:
// If ai.apiKey is missing but togetherAi.apiKey exists → migrate
if (!result.data.ai.apiKey && result.data.togetherAi?.apiKey) {
  result.data.ai.apiKey = result.data.togetherAi.apiKey;
  if (!result.data.ai.baseURL) {
    result.data.ai.baseURL = 'https://api.together.xyz/v1';
  }
}
```

### Verification:
- Existing `TOGETHER_API_KEY` env var still produces valid config
- New `AI_API_KEY` + `AI_BASE_URL` env vars work
- `bun run --filter @sm-rn/api typecheck`

---

## Task 3: Swap Dependencies

**File:** `apps/api/package.json`
**Depends on:** Nothing (can be parallel with Task 1-2)

### Changes:
```diff
  "dependencies": {
-   "together-ai": "^0.22.0",
+   "@tanstack/ai": "0.4.2",
+   "@tanstack/ai-openai": "0.4.0",
+   "@tanstack/ai-ollama": "0.4.0",
+   "@tanstack/ai-openrouter": "0.1.0",
  }
```

### Post-change:
```bash
bun install
```

### Verification:
- `bun install` succeeds without errors
- No peer dependency conflicts with existing `zod: ^4.1.5`

---

## Task 4: Create AI Adapter Factory

**File:** `apps/api/src/services/ai-client.ts` (NEW — replaces `together-client.ts`)
**Depends on:** Tasks 1, 2, 3

### Implementation:
```typescript
import { createOpenaiChat } from '@tanstack/ai-openai';
import { createOllamaChat } from '@tanstack/ai-ollama';
import { createOpenRouter } from '@tanstack/ai-openrouter';
import type { Config } from '@sm-rn/shared/schemas';
import type { AnyTextAdapter } from '@tanstack/ai';

const APP_NAME_HELICONE = 'receipthero';

/**
 * Creates a TanStack AI text adapter based on the configured provider.
 * Supports OpenAI-compatible APIs (Together AI, vLLM, etc.), Ollama, and OpenRouter.
 */
export function createAIAdapter(config: Config): ReturnType<ReturnType<typeof createOpenaiChat>> {
  const { ai, observability } = config;

  switch (ai.provider) {
    case 'openai-compat': {
      if (!ai.apiKey) {
        throw new Error('AI API key is required for openai-compat provider');
      }

      let baseURL = ai.baseURL || 'https://api.together.xyz/v1';
      const headers: Record<string, string> = {};

      // Helicone observability proxy
      if (observability?.heliconeEnabled && observability.heliconeApiKey) {
        baseURL = 'https://together.helicone.ai/v1';
        headers['Helicone-Auth'] = `Bearer ${observability.heliconeApiKey}`;
        headers['Helicone-Property-Appname'] = APP_NAME_HELICONE;
      }

      const factory = createOpenaiChat(ai.apiKey, {
        baseURL,
        defaultHeaders: Object.keys(headers).length > 0 ? headers : undefined,
      });
      return factory(ai.model);
    }

    case 'ollama': {
      const host = ai.baseURL || 'http://localhost:11434';
      const factory = createOllamaChat(host);
      return factory(ai.model);
    }

    case 'openrouter': {
      if (!ai.apiKey) {
        throw new Error('AI API key is required for openrouter provider');
      }
      const factory = createOpenRouter(ai.apiKey, {
        baseURL: ai.baseURL,
      });
      return factory(ai.model);
    }

    default:
      throw new Error(`Unknown AI provider: ${ai.provider}`);
  }
}
```

### Also:
- Delete `apps/api/src/services/together-client.ts`

### Verification:
- `bun run --filter @sm-rn/api typecheck`

---

## Task 5: Rewrite OCR Service

**File:** `apps/api/src/services/ocr.ts`
**Depends on:** Task 4

### Before:
```typescript
import type { Together } from 'together-ai';

export async function extractReceiptData(
  base64Image: string,
  togetherClient: Together
) {
  const jsonSchema = z.toJSONSchema(ReceiptExtractionSchema);
  const response = await togetherClient.chat.completions.create({
    model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    messages: [
      { role: 'system', content: '...' },
      { role: 'user', content: [
        { type: 'text', text: '...' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
      ]},
    ],
    response_format: { type: 'json_object', schema: jsonSchema },
  });
  const content = response?.choices?.[0]?.message?.content;
  const parsedJson = JSON.parse(content);
  const validated = ReceiptExtractionSchema.safeParse(parsedJson);
  return validated.data.receipts;
}
```

### After:
```typescript
import { chat } from '@tanstack/ai';

// Adapter type — imported from ai-client.ts
type AIAdapter = ReturnType<typeof import('./ai-client').createAIAdapter>;

export async function extractReceiptData(
  base64Image: string,
  adapter: AIAdapter
) {
  const result = await chat({
    adapter,
    messages: [
      {
        role: 'system',
        content: `You are an expert at extracting receipt data...` // Same prompt as before
      },
      {
        role: 'user',
        content: [
          { type: 'text', content: 'Extract receipt data from this image following the formatting and categorization rules.' },
          { type: 'image', source: { type: 'data', value: base64Image, mimeType: 'image/jpeg' } },
        ],
      },
    ],
    outputSchema: ReceiptExtractionSchema,
  });

  // TanStack AI returns typed, validated data — no manual JSON.parse needed
  return result.receipts;
}
```

### Key differences:
1. No `z.toJSONSchema()` call — TanStack AI handles schema conversion
2. No `JSON.parse()` + `safeParse()` — `outputSchema` returns validated typed data
3. Image format changes from `image_url` to `{ type: 'image', source: { type: 'data' } }`
4. System prompt stays the same

### Verification:
- `bun run --filter @sm-rn/api typecheck`

---

## Task 6: Update Bridge Service

**File:** `apps/api/src/services/bridge.ts`
**Depends on:** Tasks 4, 5

### Changes:
1. Replace `import type { Together } from 'together-ai'` with adapter type from `ai-client.ts`
2. Replace `createTogetherClient(config)` with `createAIAdapter(config)`
3. Update `processPaperlessDocument` signature: `togetherClient: Together` → `adapter: AIAdapter`
4. Update `extractReceiptData(base64, togetherClient)` → `extractReceiptData(base64, adapter)`

### Verification:
- `bun run --filter @sm-rn/api typecheck`

---

## Task 7: Update OCR Route

**File:** `apps/api/src/routes/ocr.ts`
**Depends on:** Tasks 4, 5

### Changes:
1. Replace `createTogetherClient` import with `createAIAdapter`
2. Update `const togetherClient = createTogetherClient(config)` → `const adapter = createAIAdapter(config)`
3. Update `extractReceiptData(base64Image, togetherClient)` → `extractReceiptData(base64Image, adapter)`

### Verification:
- `bun run --filter @sm-rn/api typecheck`

---

## Task 8: Replace Test Endpoint

**Files:**
- `apps/api/src/routes/test-together.ts` → DELETE
- `apps/api/src/routes/test-ai.ts` → NEW
- `apps/api/src/index.ts` → Update imports
**Depends on:** Task 4

### New `test-ai.ts`:
- `POST /api/config/test-ai` — accepts `{ provider, apiKey, baseURL, model }` in request body
- Creates a temporary adapter using the provided config
- Sends a simple test message: `"Say hello in 5 words or less"`
- Returns `{ success: true, response: "..." }` or `{ success: false, error: "..." }`
- Works for all providers (not just Together AI)

### Update `index.ts`:
```diff
- import testTogether from './routes/test-together'
+ import testAi from './routes/test-ai'

- app.route('/api/config/test-together', testTogether)
+ app.route('/api/config/test-ai', testAi)
```

### Verification:
- `bun run --filter @sm-rn/api typecheck`

---

## Task 9: Update Tests

**File:** `apps/api/src/__tests__/ocr.test.ts`
**Depends on:** Tasks 5, 6, 7

### Changes:
1. Replace `together-ai` mocking with TanStack AI mocking
2. Update test fixtures to use new adapter signature
3. Add test cases for:
   - OpenAI-compat adapter creation
   - Ollama adapter creation
   - Backward compat: `togetherAi.apiKey` → `ai.apiKey` migration
   - Config validation: missing apiKey for cloud providers

### Verification:
- `bun test`

---

## Task 10: Update Webapp Config UI

**Files:** `apps/webapp/src/` — Config page components
**Depends on:** Tasks 1, 8

### Changes:
1. Add provider selector dropdown: `openai-compat | ollama | openrouter`
2. Add fields: API Key, Base URL, Model
3. Conditionally show fields based on provider:
   - `openai-compat`: Show API Key (required), Base URL (optional, defaults to Together AI), Model
   - `ollama`: Show Base URL (optional, defaults to localhost:11434), Model
   - `openrouter`: Show API Key (required), Model
4. Replace "Test Together AI" button with "Test AI Connection" button hitting `/api/config/test-ai`
5. Save to `ai.*` fields in config.json

### Verification:
- `bun run --filter @sm-rn/webapp typecheck`
- Manual testing of config form

---

## Task 11: Update Documentation

**File:** `README.md`
**Depends on:** All previous tasks

### Changes:
1. Update "Tech Stack" section: `Together AI (LLM-powered OCR)` → `TanStack AI (multi-provider LLM OCR)`
2. Update environment variables section with new `AI_*` vars
3. Keep `TOGETHER_API_KEY` documented as backward compat
4. Add section listing supported providers
5. Update config.json example

---

## Execution Order (Dependency Graph)

```
Task 1 (Config Schema) ─┐
Task 3 (Swap Deps)  ─────┼─→ Task 4 (AI Client) ─→ Task 5 (OCR Service) ─┐
Task 2 (Config Loader) ──┘                         Task 8 (Test Endpoint) │
                                                                           ├─→ Task 9 (Tests)
                                                   Task 6 (Bridge) ────────┤
                                                   Task 7 (OCR Route) ─────┘
                                                   Task 10 (Webapp) ───────→ Task 11 (Docs)
```

### Recommended Implementation Order:
1. **Task 3** — Swap dependencies (`bun install`)
2. **Task 1** — Update config schema
3. **Task 2** — Update config loader with backward compat
4. **Task 4** — Create AI adapter factory
5. **Task 5** — Rewrite OCR service
6. **Task 6** — Update bridge service
7. **Task 7** — Update OCR route
8. **Task 8** — Replace test endpoint + update index.ts
9. **Task 9** — Update tests
10. **Task 10** — Update webapp config UI
11. **Task 11** — Update README

### Verification Checkpoints:
- After Task 4: `bun run --filter @sm-rn/api typecheck` passes
- After Task 8: Full API compiles, all routes register
- After Task 9: `bun test` passes
- After Task 10: `bun run --filter @sm-rn/webapp typecheck` passes
- Final: Full `bun run build` succeeds
