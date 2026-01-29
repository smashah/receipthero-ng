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
