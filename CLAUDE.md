# NetSuite Scripting Project

## Project Overview
This is a NetSuite SuiteScript development repository with a Next.js dashboard UI for browsing, managing, and generating scripts.

## Project Structure
- `scripts/` — SuiteScript files organized by type (UserEvent, Client, Scheduled, etc.)
- `modules/` — Reusable SuiteScript modules with versioned releases
- `dashboards/` — Dashboard-specific scripts and configurations
- `reference/` — Internal IDs, permissions, record lifecycles, list records
- `standards/` — Coding standards, naming conventions, JSDoc requirements
- `maps/` — Dependency maps showing script relationships
- `_inbox/` — Staging area for work-in-progress files
- `src/` — Next.js dashboard application (TypeScript, React, Tailwind)

## Coding Standards

### SuiteScript Rules
- All scripts MUST use `@NApiVersion 2.1`
- All scripts MUST include proper JSDoc headers with `@NScriptType`
- Use `define([...], (...) => { ... })` module pattern for SuiteScript 2.1
- Always reference `reference/internal-ids.md` for field internal IDs before hardcoding values
- Check `reference/permissions.md` before using restricted APIs
- Follow naming conventions from `standards/` directory

### Dashboard App Rules (src/)
- Next.js 16 with App Router
- TypeScript strict mode
- Tailwind CSS v4 for styling
- shadcn/ui components (in `src/components/ui/`)
- Dark mode enabled globally
- API routes in `src/app/api/`
- Shared components in `src/components/shared/`
- Custom hooks in `src/hooks/`
- Types in `src/types/index.ts`

## Key Files to Reference
- `reference/internal-ids.md` — NetSuite field internal IDs
- `reference/permissions.md` — Role and permission mappings
- `reference/record-lifecycles.md` — Record state transitions
- `standards/` — All coding and documentation standards
- `src/types/index.ts` — TypeScript interfaces for the dashboard
- `src/hooks/use-repo.tsx` — Main data context (RepoProvider)

## Script Types
- `client` — Client Scripts (field changes, page init, save/submit)
- `user-event` — User Event Scripts (beforeLoad, beforeSubmit, afterSubmit)
- `scheduled` — Scheduled Scripts (batch processing)
- `suitelet` — Suitelets (custom UI pages)
- `restlet` — RESTlets (REST API endpoints)
- `map-reduce` — Map/Reduce Scripts (large data processing)
- `workflow-action` — Workflow Action Scripts
