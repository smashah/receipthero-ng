# Config PATCH Semantics Implementation

## Context

### Original Request
Fix the Settings page to handle Zod validation errors from the API when masked fields are omitted from the payload. Implement PATCH semantics so the API merges partial config updates with existing config instead of requiring a full config object.

### Problem Analysis
The current implementation has these issues:
1. **Settings page** sends partial config (masked fields omitted)
2. **API** uses `ConfigSchema` which requires all fields (e.g., `togetherAi.apiKey` is required)
3. **Zod validation fails** with: `"expected": "string", "code": "invalid_type", "path": ["togetherAi", "apiKey"]`

### Root Cause
When the user doesn't change a masked API key, the Settings page deletes it from the payload (correct behavior), but the API's Zod validator expects the full config object.

### Solution
1. Create `PartialConfigSchema` in shared package (all fields optional)
2. Update API to use PATCH semantics (merge partial with existing config)
3. Update webapp to better handle Zod error responses
4. Change HTTP method from POST to PATCH (semantic correctness)

---

## Work Objectives

### Core Objective
Implement PATCH semantics for config updates so users can update individual fields without providing the entire config object.

### Concrete Deliverables
- `packages/shared/src/schemas.ts` - Add `PartialConfigSchema`
- `apps/api/src/routes/config.ts` - Update POST handler to merge partial config
- `apps/webapp/src/lib/api.ts` - Add Zod error type
- `apps/webapp/src/routes/settings.tsx` - Handle validation errors with field-specific messages

### Definition of Done
- [x] Saving config with masked fields (unchanged) works without error
- [x] Partial config updates merge correctly with existing config
- [x] Zod validation errors display user-friendly field-specific messages
- [x] All existing tests still pass

### Must Have
- Deep merge of partial config with existing config
- Preserve masked/unchanged sensitive fields
- User-friendly error messages for validation failures

### Must NOT Have
- Breaking changes to GET /api/config response format
- Changes to the config file format (config.json)
- New API endpoints (reuse existing POST /api/config)

---

## TODOs

- [ ] 1. Add PartialConfigSchema to Shared Package

  **What to do**:
  - Edit `packages/shared/src/schemas.ts`
  - Add `PartialConfigSchema` where all nested fields are optional
  - Export `PartialConfig` type
  - Keep original `ConfigSchema` for loading/validation

  **Code to add after `ConfigSchema`**:
  ```typescript
  // ─────────────────────────────────────────────────────────────────────────────
  // Partial Config Schema for PATCH semantics
  // All fields are optional - API will merge with existing config
  // ─────────────────────────────────────────────────────────────────────────────

  export const PartialConfigSchema = z.object({
    paperless: z.object({
      host: z.string().url("PAPERLESS_HOST must be a valid URL").optional(),
      apiKey: z.string().min(1, "PAPERLESS_API_KEY is required").optional(),
    }).optional(),
    togetherAi: z.object({
      apiKey: z.string().min(1, "TOGETHER_API_KEY is required").optional(),
    }).optional(),
    processing: z.object({
      scanInterval: z.number().positive().optional(),
      receiptTag: z.string().optional(),
      processedTag: z.string().optional(),
      failedTag: z.string().optional(),
      maxRetries: z.number().int().positive().optional(),
    }).optional(),
    rateLimit: z.object({
      enabled: z.boolean().optional(),
      upstashUrl: z.string().optional(),
      upstashToken: z.string().optional(),
    }).optional(),
    observability: z.object({
      heliconeEnabled: z.boolean().optional(),
      heliconeApiKey: z.string().optional(),
    }).optional(),
  });

  export type PartialConfig = z.infer<typeof PartialConfigSchema>;
  ```

  **Acceptance Criteria**:
  - [ ] `PartialConfigSchema` exported from `@sm-rn/shared/schemas`
  - [ ] `PartialConfig` type exported
  - [ ] TypeScript compiles without errors

  **Commit**: YES
  - Message: `feat(shared): add PartialConfigSchema for PATCH semantics`
  - Files: `packages/shared/src/schemas.ts`

---

- [ ] 2. Update API Config Route for PATCH Semantics

  **What to do**:
  - Edit `apps/api/src/routes/config.ts`
  - Change `zValidator` to use `PartialConfigSchema`
  - Load existing config first
  - Deep merge partial update with existing config
  - Validate merged result with `ConfigSchema` before saving
  - Return detailed validation errors if merge result is invalid

  **Replace the POST handler with**:
  ```typescript
  import { PartialConfigSchema, ConfigSchema } from '@sm-rn/shared/schemas';

  // Helper for deep merge (handles nested objects)
  function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key in source) {
      if (source[key] !== undefined) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof target[key] === 'object' &&
          target[key] !== null
        ) {
          result[key] = deepMerge(target[key], source[key] as any);
        } else {
          result[key] = source[key] as any;
        }
      }
    }
    return result;
  }

  // POST /api/config - Save configuration (PATCH semantics)
  config.post('/', zValidator('json', PartialConfigSchema), async (c) => {
    try {
      const partialConfig = c.req.valid('json');

      // Load existing config
      let existingConfig;
      try {
        existingConfig = loadConfig();
      } catch {
        // No existing config - need full config for first-time setup
        const parseResult = ConfigSchema.safeParse(partialConfig);
        if (!parseResult.success) {
          return c.json(
            { 
              success: false, 
              error: {
                name: 'ValidationError',
                message: 'First-time setup requires all required fields',
                issues: parseResult.error.issues
              }
            },
            400
          );
        }
        existingConfig = parseResult.data;
      }

      // Deep merge partial config with existing
      const mergedConfig = deepMerge(existingConfig, partialConfig);

      // Validate the merged result
      const parseResult = ConfigSchema.safeParse(mergedConfig);
      if (!parseResult.success) {
        return c.json(
          { 
            success: false, 
            error: {
              name: 'ValidationError',
              message: 'Invalid configuration after merge',
              issues: parseResult.error.issues
            }
          },
          400
        );
      }

      // Ensure directory exists
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write config file
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(parseResult.data, null, 2), 'utf-8');

      return c.json({ success: true, message: 'Configuration saved' });
    } catch (error) {
      return c.json(
        { 
          success: false,
          error: { 
            name: 'ServerError',
            message: error instanceof Error ? error.message : String(error) 
          }
        },
        500
      );
    }
  });
  ```

  **Acceptance Criteria**:
  - [ ] Partial config merges with existing config
  - [ ] Masked/omitted fields are preserved from existing config
  - [ ] Validation errors return structured `issues` array
  - [ ] First-time setup still works (requires full config)

  **Commit**: YES
  - Message: `feat(api): implement PATCH semantics for config updates`
  - Files: `apps/api/src/routes/config.ts`

---

- [ ] 3. Update API Types and Error Handling in Webapp

  **What to do**:
  - Edit `apps/webapp/src/lib/api.ts`
  - Add `ZodValidationError` interface for structured error responses
  - Update `FetchError` to handle Zod errors

  **Add these types**:
  ```typescript
  export interface ZodIssue {
    code: string;
    path: (string | number)[];
    message: string;
    expected?: string;
    received?: string;
  }

  export interface ZodValidationError {
    success: false;
    error: {
      name: 'ValidationError' | 'ZodError';
      message: string;
      issues?: ZodIssue[];
    };
  }

  export interface ApiErrorResponse {
    success: false;
    error: {
      name: string;
      message: string;
      issues?: ZodIssue[];
    };
  }
  ```

  **Update FetchError class**:
  ```typescript
  export class FetchError extends Error {
    constructor(
      public status: number,
      public statusText: string,
      public data?: ApiErrorResponse | ApiError
    ) {
      const message = this.extractMessage(data) || `${status} ${statusText}`;
      super(message);
      this.name = 'FetchError';
    }

    private extractMessage(data: ApiErrorResponse | ApiError | undefined): string | undefined {
      if (!data) return undefined;
      if ('error' in data && typeof data.error === 'object') {
        return data.error.message;
      }
      if ('error' in data && typeof data.error === 'string') {
        return data.error;
      }
      return undefined;
    }

    get validationIssues(): ZodIssue[] | undefined {
      if (this.data && 'error' in this.data && typeof this.data.error === 'object') {
        return this.data.error.issues;
      }
      return undefined;
    }

    get isValidationError(): boolean {
      if (this.data && 'error' in this.data && typeof this.data.error === 'object') {
        return ['ValidationError', 'ZodError'].includes(this.data.error.name);
      }
      return false;
    }
  }
  ```

  **Acceptance Criteria**:
  - [ ] `ZodIssue` and `ZodValidationError` types exported
  - [ ] `FetchError.validationIssues` property available
  - [ ] `FetchError.isValidationError` helper available
  - [ ] TypeScript compiles without errors

  **Commit**: YES (groups with Task 4)
  - Message: `feat(webapp): add validation error types and improved error handling`
  - Files: `apps/webapp/src/lib/api.ts`

---

- [ ] 4. Update Settings Page Error Handling

  **What to do**:
  - Edit `apps/webapp/src/routes/settings.tsx`
  - Import `FetchError` from api.ts
  - Update `handleSave` to catch validation errors
  - Display field-specific error messages using toast
  - Remove overly-aggressive client-side validation for masked fields

  **Update the handleSave function**:
  ```typescript
  import { FetchError } from '../lib/api'

  const handleSave = async () => {
    // Basic validation (keep URL format check)
    if (!localConfig.paperless.host) {
      toast.error('Paperless Host is required')
      return
    }
    try {
      new URL(localConfig.paperless.host)
    } catch {
      toast.error('Invalid Paperless Host URL')
      return
    }

    // Prepare payload - omit masked fields (they'll be preserved by API)
    const payload = JSON.parse(JSON.stringify(localConfig))

    // Remove masked values - API will preserve existing
    if (isMasked(payload.paperless?.apiKey)) {
      delete payload.paperless.apiKey
    }
    if (isMasked(payload.togetherAi?.apiKey)) {
      delete payload.togetherAi.apiKey
    }
    if (payload.rateLimit && isMasked(payload.rateLimit.upstashToken)) {
      delete payload.rateLimit.upstashToken
    }
    if (payload.observability && isMasked(payload.observability.heliconeApiKey)) {
      delete payload.observability.heliconeApiKey
    }

    // Clean up empty nested objects
    if (payload.paperless && Object.keys(payload.paperless).length === 0) {
      delete payload.paperless
    }
    if (payload.togetherAi && Object.keys(payload.togetherAi).length === 0) {
      delete payload.togetherAi
    }

    try {
      await saveConfigMutation.mutateAsync(payload)
      toast.success('Configuration saved successfully!')
      navigate({ to: '/' })
    } catch (error) {
      if (error instanceof FetchError && error.isValidationError) {
        // Handle validation errors with field-specific messages
        const issues = error.validationIssues
        if (issues && issues.length > 0) {
          // Show first validation error
          const issue = issues[0]
          const fieldPath = issue.path.join('.')
          toast.error(`${fieldPath}: ${issue.message}`)
        } else {
          toast.error(error.message || 'Validation failed')
        }
      } else if (error instanceof FetchError) {
        toast.error(error.message || 'Failed to save configuration')
      } else {
        toast.error('Failed to save configuration')
      }
    }
  }
  ```

  **Also remove the client-side validation that blocks on masked values**:
  - Remove the check `if (!localConfig.paperless.apiKey)` that blocks save
  - Remove the check `if (!localConfig.togetherAi.apiKey)` that blocks save
  - Let the API handle validation - it knows if the field is truly missing or just masked

  **Acceptance Criteria**:
  - [ ] Saving with masked (unchanged) API keys works
  - [ ] Validation errors show field-specific messages
  - [ ] First-time setup still requires all fields
  - [ ] Error toast shows meaningful message from API

  **Commit**: YES
  - Message: `fix(webapp): handle PATCH semantics and validation errors in Settings`
  - Files: `apps/webapp/src/routes/settings.tsx`, `apps/webapp/src/lib/api.ts`

---

- [ ] 5. Update useSaveConfig Mutation Type

  **What to do**:
  - Edit `apps/webapp/src/lib/queries.ts`
  - Update `useSaveConfig` to accept `Partial<Config>` or `PartialConfig`
  - This allows sending partial updates

  **Update mutation**:
  ```typescript
  import type { Config, PartialConfig } from '@sm-rn/shared/schemas';

  export function useSaveConfig() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (config: Partial<Config>) =>
        fetchApi<SaveConfigResponse>('/api/config', {
          method: 'POST',
          body: JSON.stringify(config),
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: configKeys.all });
        queryClient.invalidateQueries({ queryKey: healthKeys.all });
      },
    });
  }
  ```

  **Acceptance Criteria**:
  - [ ] `useSaveConfig` accepts partial config
  - [ ] TypeScript compiles without errors

  **Commit**: YES (groups with Task 4)
  - Message: `fix(webapp): update useSaveConfig to accept partial config`
  - Files: `apps/webapp/src/lib/queries.ts`

---

- [ ] 6. Test and Verify

  **What to do**:
  - Run existing tests to ensure no regressions
  - Manually test the save flow:
    1. Load settings page (shows masked API keys)
    2. Change only the scan interval
    3. Save - should succeed without Zod errors
    4. Reload - verify all settings preserved
  - Test first-time setup (no existing config)

  **Verification Commands**:
  ```bash
  # Run webapp tests
  bun run --filter @sm-rn/webapp test

  # Run API (start in one terminal)
  bun run --filter @sm-rn/api dev

  # Test PATCH endpoint manually
  curl -X POST http://localhost:3001/api/config \
    -H "Content-Type: application/json" \
    -d '{"processing": {"scanInterval": 120000}}'
  ```

  **Acceptance Criteria**:
  - [ ] All existing tests pass
  - [ ] Partial update saves correctly
  - [ ] Masked fields preserved on partial update
  - [ ] First-time setup requires all fields

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files |
|------------|---------|-------|
| 1 | `feat(shared): add PartialConfigSchema for PATCH semantics` | packages/shared/src/schemas.ts |
| 2 | `feat(api): implement PATCH semantics for config updates` | apps/api/src/routes/config.ts |
| 4 | `fix(webapp): handle PATCH semantics and validation errors in Settings` | apps/webapp/src/\* |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
bun run test

# Build succeeds
bun run build
```

### Final Checklist
- [ ] Saving config with masked fields works without Zod errors
- [ ] Partial updates merge with existing config correctly
- [ ] Validation errors show user-friendly messages
- [ ] First-time setup still requires all required fields
- [ ] All existing tests pass
