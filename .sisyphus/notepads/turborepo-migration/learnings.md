# Turborepo Migration - Learnings & Conventions

This notepad tracks patterns, conventions, and architectural decisions discovered during the migration.

---

## [2026-01-28 23:45] Task 0: Initialize Turborepo

### Actions Taken
- Archived all legacy code to `_legacy/` folder (preserving .git, node_modules, .sisyphus)
- Created Turborepo structure with `apps/` and `packages/` directories
- Created root package.json with workspaces config and Bun package manager
- Created turbo.json with task pipeline configuration
- Installed turbo@2.8.0 via `bun install`
- Committed changes

### Key Decisions
- Used Bun 1.2.0 as packageManager (per plan requirements)
- Turborepo 2.8.0 installed (latest stable, plan required 2.6+)
- Manual creation instead of `bunx create-turbo` for cleaner control

### Structure Created
```
receipthero-ng/
├── _legacy/           # All original code safely archived
├── apps/              # Ready for @sm-rn/api and @sm-rn/webapp
├── packages/          # Ready for @sm-rn/shared
├── package.json       # Turborepo root with workspaces
├── turbo.json         # Task pipeline config
└── bun.lock           # Lockfile
```

### Verification
- ✅ `bun install` completed successfully
- ✅ All legacy files preserved in _legacy/
- ✅ Git commit created: de50887
- ✅ 252 files changed, clean migration

