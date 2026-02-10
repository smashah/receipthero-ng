# Webapp Pages Implementation

## Context

### Original Request
Build Dashboard and Settings pages for ReceiptHero-NG webapp using TanStack Start + shadcn, following patterns from the legacy Next.js implementation.

### Interview Summary
**Key Discussions**:
- Dashboard: Health status cards with 30s auto-polling, connection status, config summary showing key settings
- Settings: Hybrid config editing (form fields for core settings, EnvEditor for advanced/observability)
- Data fetching: TanStack Query for caching, auto-refetch, and loading states
- Responsive: Desktop-first with CSS Grid/Flexbox reflow (not mobile-optimized UX)
- Testing: Component tests with Vitest for critical paths

**Research Findings**:
- Legacy dashboard uses 30s polling, Card components, custom Badge variants, grid layout
- Legacy setup has <details> toggle for advanced settings, mask-aware saves, toast feedback
- Config schema has: paperless, togetherAi, processing, rateLimit, observability sections
- Current webapp is fresh TanStack Start with shadcn components ready, no data fetching yet

### Metis Review
**Identified Gaps** (addressed):
- Mobile UX scope: Clarified as responsive reflow (Option A), not mobile-optimized
- Dashboard config summary: Shows connection status + key settings (interval, tags, retries)
- Mask-aware saves: Only send unmasked values (detect masked strings, omit from request)
- Test coverage: Critical paths only (form submit, polling, connection tests, error states)
- @elements components: Will install and verify compatibility before use

---

## Work Objectives

### Core Objective
Build a fully functional Dashboard and Settings page that allows users to monitor system health and configure the ReceiptHero integration with Paperless-NGX and Together AI.

### Concrete Deliverables
- `apps/webapp/src/routes/index.tsx` - Dashboard page
- `apps/webapp/src/routes/settings.tsx` - Settings page
- `apps/webapp/src/lib/api.ts` - TanStack Query API client
- `apps/webapp/src/components/` - Reusable components (StatusCard, ConnectionTest, etc.)
- `apps/webapp/src/__tests__/` - Component tests for critical paths

### Definition of Done
- [x] Dashboard shows live health status with 30s auto-polling
- [x] Settings form saves all config fields successfully
- [x] Connection testing works for Paperless and Together AI
- [x] All tests pass: `bun run --filter @sm-rn/webapp test`
- [x] Responsive layout works on desktop, tablet, and mobile breakpoints

### Must Have
- Health status polling with cleanup on unmount/visibility change
- Form validation matching legacy behavior (client-side presence checks)
- Toast notifications for success/error feedback
- Loading states for all async operations
- Mask-aware saves (don't overwrite masked API keys)

### Must NOT Have (Guardrails)
- Dark mode toggle
- Config export/import functionality
- Audit log or change history
- User authentication or permissions
- WebSocket real-time updates
- Hamburger menu or separate mobile navigation
- Touch gestures (swipe, pinch-zoom)
- Advanced regex validation beyond legacy
- Custom components when shadcn equivalents exist

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest configured)
- **User wants tests**: YES (component tests for critical paths)
- **Framework**: Vitest

### Test Scope (Critical Paths Only)
- Dashboard: Polling lifecycle (start, pause on hidden, cleanup on unmount)
- Dashboard: Health check error handling (503, network timeout)
- Settings: Form submission and validation
- Settings: Connection test button states
- Both: Loading and error states render correctly

---

## Task Flow

```
Task 0 (Foundation) → Task 1 (API Client) → Task 2 (Dashboard) → Task 3 (Settings) → Task 4 (Tests)
                                                ↓
                                          Task 2a (StatusCard)
```

## Parallelization

| Task | Depends On | Reason |
|------|------------|--------|
| 0 | None | Foundation cleanup |
| 1 | 0 | Needs clean workspace |
| 2, 2a | 1 | Needs API client |
| 3 | 1 | Needs API client |
| 4 | 2, 3 | Needs pages to exist |

---

## TODOs

- [x] 0. Clean Workspace and Install @elements Components

  **What to do**:
  - Delete placeholder files: `apps/webapp/src/routes/index.tsx` (will recreate), `apps/webapp/src/components/component-example.tsx`
  - Install @elements components: `bunx shadcn@latest add env-editor json-viewer error-boundary-ui`
  - Verify installation by checking `apps/webapp/src/components/ui/` for new files
  - If @elements fail to install, document error and use fallback (shadcn Textarea + syntax highlighting)

  **Must NOT do**:
  - Delete `__root.tsx` (needed for layout)
  - Delete `apps/webapp/src/components/ui/` (shadcn components needed)
  - Modify any files outside `apps/webapp/`

  **Parallelizable**: NO (foundation task)

  **References**:
  
  **Pattern References**:
  - `apps/webapp/src/components/ui/` - Existing shadcn components to preserve

  **Documentation References**:
  - shadcn CLI: `bunx shadcn@latest add <component>` pattern

  **Acceptance Criteria**:
  - [ ] `apps/webapp/src/routes/index.tsx` deleted
  - [ ] `apps/webapp/src/components/component-example.tsx` deleted
  - [ ] `bunx shadcn@latest add env-editor json-viewer error-boundary-ui` completed
  - [ ] New component files exist in `apps/webapp/src/components/ui/`
  - [ ] If install fails: fallback documented, plan adjusted

  **Manual Execution Verification**:
  - [ ] Command: `ls apps/webapp/src/components/ui/`
  - [ ] Expected: Shows env-editor.tsx, json-viewer.tsx, error-boundary-ui.tsx (or fallback noted)

  **Commit**: YES
  - Message: `chore(webapp): clean placeholders and install @elements components`
  - Files: `apps/webapp/src/`
  - Pre-commit: N/A

---

- [x] 1. Setup TanStack Query and API Client

  **What to do**:
  - Install TanStack Query: `bun add @tanstack/react-query` in apps/webapp
  - Create `apps/webapp/src/lib/api.ts` with:
    - `API_BASE_URL` constant (defaults to `http://localhost:3001`)
    - `fetchApi` wrapper function with error handling
    - Query key factories: `healthKeys`, `configKeys`
  - Create `apps/webapp/src/lib/queries.ts` with:
    - `useHealth()` - fetches GET /api/health with 30s refetchInterval
    - `useConfig()` - fetches GET /api/config
    - `useSaveConfig()` - mutation for POST /api/config
    - `useTestPaperless()` - mutation for POST /api/config/test-paperless
    - `useTestTogether()` - mutation for POST /api/config/test-together
  - Add QueryClientProvider to `apps/webapp/src/routes/__root.tsx`
  - Configure polling to pause when `document.visibilityState === 'hidden'`

  **Must NOT do**:
  - Add WebSocket support
  - Add authentication headers
  - Create separate mobile API client

  **Parallelizable**: NO (depends on 0)

  **References**:

  **Pattern References**:
  - `_legacy/app/page.tsx:75-105` - Polling pattern with setInterval and cleanup
  - `apps/api/src/routes/health.ts:1-50` - Health response shape: `{ status, timestamp, checks, errors? }`
  - `apps/api/src/routes/config.ts:1-80` - Config endpoints and masked key handling

  **API/Type References**:
  - `packages/shared/src/schemas.ts:ConfigSchema` - Zod schema for config validation
  - `apps/api/src/routes/health.ts` - Health response: `{ status: 'healthy'|'unhealthy', checks: {...}, errors?: string[] }`

  **Documentation References**:
  - TanStack Query docs: `https://tanstack.com/query/latest/docs/react/guides/queries`
  - TanStack Query refetchInterval: `https://tanstack.com/query/latest/docs/react/guides/window-focus-refetching`

  **Acceptance Criteria**:
  - [ ] `bun add @tanstack/react-query` completed in apps/webapp
  - [ ] `apps/webapp/src/lib/api.ts` exports `fetchApi`, `API_BASE_URL`
  - [ ] `apps/webapp/src/lib/queries.ts` exports `useHealth`, `useConfig`, `useSaveConfig`, `useTestPaperless`, `useTestTogether`
  - [ ] `apps/webapp/src/routes/__root.tsx` wraps children in QueryClientProvider
  - [ ] `bun run --filter @sm-rn/webapp typecheck` passes

  **Manual Execution Verification**:
  - [ ] Command: `bun run --filter @sm-rn/webapp typecheck`
  - [ ] Expected: No errors

  **Commit**: YES
  - Message: `feat(webapp): add TanStack Query API client with health/config hooks`
  - Files: `apps/webapp/src/lib/`, `apps/webapp/src/routes/__root.tsx`, `apps/webapp/package.json`
  - Pre-commit: `bun run --filter @sm-rn/webapp typecheck`

---

- [x] 2. Build Dashboard Page

  **What to do**:
  - Create `apps/webapp/src/routes/index.tsx` with:
    - Header: Title "ReceiptHero Dashboard", last updated timestamp, Refresh button, Settings link
    - Status Overview (3 cards in responsive grid):
      - System Health: Overall status badge (Healthy/Unhealthy), error count
      - Paperless Connection: Connection status, host URL
      - Together AI: API key status (configured/missing)
    - Detailed Section (responsive 2-column on desktop, 1-column on mobile):
      - Health Checks Detail: Individual check status for paperless, togetherAi, config
      - Active Errors: Conditional red alert when unhealthy (list error strings)
      - Config Summary: Key settings (scanInterval, tags, maxRetries)
  - Use `useHealth()` query with 30s polling
  - Use `useConfig()` query for config summary
  - Add loading skeleton while data loads
  - Add manual refresh button that triggers refetch

  **Must NOT do**:
  - Add dark mode toggle
  - Add inline config editing (view-only)
  - Add WebSocket updates
  - Create hamburger menu

  **Parallelizable**: NO (depends on 1)

  **References**:

  **Pattern References**:
  - `_legacy/app/page.tsx:1-340` - Complete dashboard implementation to port
  - `_legacy/app/page.tsx:51-73` - Custom Badge component with variants
  - `_legacy/app/page.tsx:115-180` - Status overview cards layout
  - `_legacy/app/page.tsx:182-280` - Detailed health checks and config summary

  **API/Type References**:
  - `apps/api/src/routes/health.ts` - Health response shape
  - `packages/shared/src/schemas.ts` - Config type for summary display

  **Component References**:
  - `apps/webapp/src/components/ui/card.tsx` - Card, CardHeader, CardTitle, CardContent
  - `apps/webapp/src/components/ui/badge.tsx` - Badge component
  - `apps/webapp/src/components/ui/button.tsx` - Button component

  **Acceptance Criteria**:
  - [ ] Dashboard renders at route `/`
  - [ ] 3 status cards visible: System Health, Paperless, Together AI
  - [ ] Health data refreshes every 30 seconds automatically
  - [ ] Polling pauses when browser tab is hidden
  - [ ] Refresh button triggers immediate data fetch
  - [ ] Settings link navigates to `/settings`
  - [ ] Error state shows when API returns 503
  - [ ] Loading skeleton shows while initial data loads
  - [ ] Responsive: 3 columns on desktop, 2 on tablet, 1 on mobile

  **Manual Execution Verification**:
  - [ ] Using Playwright browser automation:
    - Start dev server: `bun run --filter @sm-rn/webapp dev`
    - Navigate to: `http://localhost:3000/`
    - Verify: 3 status cards visible
    - Verify: Last updated timestamp updates every 30s
    - Click: Refresh button
    - Verify: Timestamp updates immediately
    - Click: Settings/Configure link
    - Verify: Navigates to `/settings`

  **Commit**: YES
  - Message: `feat(webapp): add Dashboard page with health monitoring`
  - Files: `apps/webapp/src/routes/index.tsx`
  - Pre-commit: `bun run --filter @sm-rn/webapp typecheck`

---

- [x] 2a. Create Reusable StatusCard Component

  **What to do**:
  - Create `apps/webapp/src/components/status-card.tsx`:
    - Props: `title`, `status` (ok/error/loading), `subtitle`, `icon`, `children`
    - Uses shadcn Card with consistent styling
    - Status-based color theming (green for ok, red for error, gray for loading)
    - Icon slot for service-specific icons
  - Create `apps/webapp/src/components/health-badge.tsx`:
    - Props: `status` ('healthy'|'unhealthy'|'loading')
    - Uses shadcn Badge with variant mapping
    - Consistent with legacy Badge behavior

  **Must NOT do**:
  - Create custom Card (extend shadcn)
  - Add animation beyond loading spinner
  - Add click handlers (cards are display-only)

  **Parallelizable**: YES (with Task 2, same dependency)

  **References**:

  **Pattern References**:
  - `_legacy/app/page.tsx:51-73` - Badge component implementation
  - `_legacy/app/page.tsx:120-178` - Status card usage pattern

  **Component References**:
  - `apps/webapp/src/components/ui/card.tsx` - Base Card component
  - `apps/webapp/src/components/ui/badge.tsx` - Base Badge component

  **Acceptance Criteria**:
  - [ ] `StatusCard` component renders with all props
  - [ ] `HealthBadge` shows correct color for each status
  - [ ] Components are exported from their files
  - [ ] `bun run --filter @sm-rn/webapp typecheck` passes

  **Commit**: YES (groups with Task 2)
  - Message: `feat(webapp): add StatusCard and HealthBadge components`
  - Files: `apps/webapp/src/components/`

---

- [x] 3. Build Settings Page

  **What to do**:
  - Create `apps/webapp/src/routes/settings.tsx` with:
    - Header: Title "Configuration", Back to Dashboard link
    - Core Settings Form (standard inputs):
      - Paperless section: Host URL input, API Key input (password type)
      - Together AI section: API Key input (password type)
      - Processing section: Scan Interval (number), Receipt Tag, Processed Tag, Failed Tag, Max Retries
    - Connection Test Buttons:
      - "Test Paperless" button with loading state
      - "Test Together AI" button with loading state
      - Toast feedback for success/failure
    - Advanced Settings (collapsible via <details> or Collapsible component):
      - Rate Limiting: Enabled toggle, Upstash URL, Upstash Token
      - Observability: Helicone Enabled toggle, Helicone API Key
      - Use EnvEditor component for these key-value pairs
    - Save button with loading state
    - Form validation: Required fields, URL format for host
  - Implement mask-aware saves:
    - Detect if API key field contains masked value (format: `xxx...xxxx`)
    - Omit masked fields from save request
    - Only send fields user actually changed

  **Must NOT do**:
  - Add config export/import
  - Add undo/redo functionality
  - Add field-level history
  - Auto-save on change

  **Parallelizable**: YES (with Task 2, same dependency on Task 1)

  **References**:

  **Pattern References**:
  - `_legacy/app/setup/page.tsx:1-386` - Complete setup wizard to port
  - `_legacy/app/setup/page.tsx:45-80` - Form state management pattern
  - `_legacy/app/setup/page.tsx:82-130` - Connection test handlers
  - `_legacy/app/setup/page.tsx:200-280` - Advanced settings in <details>

  **API/Type References**:
  - `packages/shared/src/schemas.ts:ConfigSchema` - All config fields and validation
  - `apps/api/src/routes/config.ts:POST` - Save endpoint, expects full config object

  **Component References**:
  - `apps/webapp/src/components/ui/input.tsx` - Input component
  - `apps/webapp/src/components/ui/label.tsx` - Label component
  - `apps/webapp/src/components/ui/button.tsx` - Button component
  - `apps/webapp/src/components/ui/field.tsx` - Field wrapper (if exists)
  - `apps/webapp/src/components/ui/env-editor.tsx` - EnvEditor for advanced settings

  **Documentation References**:
  - TanStack Query mutations: `https://tanstack.com/query/latest/docs/react/guides/mutations`

  **Acceptance Criteria**:
  - [ ] Settings page renders at route `/settings`
  - [ ] All core config fields visible and editable
  - [ ] API keys show as password inputs (masked display)
  - [ ] "Test Paperless" button triggers connection test with loading state
  - [ ] "Test Together AI" button triggers test with loading state
  - [ ] Toast appears on test success/failure
  - [ ] Advanced settings hidden by default, expandable
  - [ ] EnvEditor renders for rate limiting and observability
  - [ ] Save button submits form with loading state
  - [ ] Masked values not sent in save request
  - [ ] Redirect to Dashboard after successful save
  - [ ] Form shows validation errors for required fields

  **Manual Execution Verification**:
  - [ ] Using Playwright browser automation:
    - Navigate to: `http://localhost:3000/settings`
    - Verify: Form fields visible for Paperless, Together AI, Processing
    - Fill: All required fields with test values
    - Click: "Test Paperless" button
    - Verify: Button shows loading spinner, toast appears
    - Click: Advanced Settings toggle
    - Verify: Rate Limiting and Observability fields appear
    - Click: "Save" button
    - Verify: Loading state, then redirect to `/`

  **Commit**: YES
  - Message: `feat(webapp): add Settings page with config form and connection testing`
  - Files: `apps/webapp/src/routes/settings.tsx`
  - Pre-commit: `bun run --filter @sm-rn/webapp typecheck`

---

- [x] 4. Add Component Tests for Critical Paths

  **What to do**:
  - Create `apps/webapp/src/__tests__/setup.ts` with test utilities:
    - QueryClient wrapper for testing
    - Mock API responses for health and config endpoints
  - Create `apps/webapp/src/__tests__/dashboard.test.tsx`:
    - Test: Renders loading skeleton initially
    - Test: Displays health data when loaded
    - Test: Shows error state on API failure
    - Test: Refresh button triggers refetch
  - Create `apps/webapp/src/__tests__/settings.test.tsx`:
    - Test: Renders all form fields
    - Test: Shows validation errors for empty required fields
    - Test: Connection test button triggers mutation
    - Test: Save button submits form data
    - Test: Masked values detected and omitted

  **Must NOT do**:
  - Visual regression testing
  - Accessibility audits (separate task)
  - E2E tests with real API
  - Test every prop/variant combination

  **Parallelizable**: NO (depends on 2, 3)

  **References**:

  **Pattern References**:
  - TanStack Query testing patterns: Query wrapper, mock responses

  **Documentation References**:
  - Vitest docs: `https://vitest.dev/guide/`
  - TanStack Query testing: `https://tanstack.com/query/latest/docs/react/guides/testing`

  **Acceptance Criteria**:
  - [ ] Test files created in `apps/webapp/src/__tests__/`
  - [ ] All tests pass: `bun run --filter @sm-rn/webapp test`
  - [ ] Coverage includes: Dashboard render, Settings form, connection tests, error states

  **Manual Execution Verification**:
  - [ ] Command: `bun run --filter @sm-rn/webapp test`
  - [ ] Expected: All tests pass, no failures

  **Commit**: YES
  - Message: `test(webapp): add component tests for Dashboard and Settings`
  - Files: `apps/webapp/src/__tests__/`
  - Pre-commit: `bun run --filter @sm-rn/webapp test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `chore(webapp): clean placeholders and install @elements components` | src/routes/, src/components/ | ls components/ui/ |
| 1 | `feat(webapp): add TanStack Query API client with health/config hooks` | src/lib/, src/routes/__root.tsx | typecheck |
| 2 + 2a | `feat(webapp): add Dashboard page with health monitoring` | src/routes/index.tsx, src/components/ | typecheck |
| 3 | `feat(webapp): add Settings page with config form and connection testing` | src/routes/settings.tsx | typecheck |
| 4 | `test(webapp): add component tests for Dashboard and Settings` | src/__tests__/ | test |

---

## Success Criteria

### Verification Commands
```bash
# Typecheck passes
bun run --filter @sm-rn/webapp typecheck

# Tests pass
bun run --filter @sm-rn/webapp test

# Dev server runs
bun run --filter @sm-rn/webapp dev

# Navigate to localhost:3000 - Dashboard loads
# Navigate to localhost:3000/settings - Settings loads
```

### Final Checklist
- [x] Dashboard shows live health status with auto-refresh
- [x] Settings form saves config without errors
- [x] Connection testing works for both services
- [x] Toast notifications appear for all actions
- [x] Responsive layout works at all breakpoints
- [x] All component tests pass
- [x] No "Must NOT Have" items accidentally included
