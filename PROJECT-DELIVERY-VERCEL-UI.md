# Project Delivery: NetSuite Dashboard Manager — Vercel Frontend

> Hand this file to a Claude Code instance. It contains everything needed to build the full application.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Data Source: Repo Structure](#4-data-source-repo-structure)
5. [Application Pages & Views](#5-application-pages--views)
6. [Component Specifications](#6-component-specifications)
7. [Data Models & Types](#7-data-models--types)
8. [GitHub API Integration](#8-github-api-integration)
9. [Markdown Parsing Engine](#9-markdown-parsing-engine)
10. [Dependency Graph Visualization](#10-dependency-graph-visualization)
11. [Analyze All Scripts Feature](#11-analyze-all-scripts-feature)
12. [File Structure (Next.js App)](#12-file-structure-nextjs-app)
13. [Environment Variables](#13-environment-variables)
14. [Authentication & Security](#14-authentication--security)
15. [Deployment](#15-deployment)
16. [UI/UX Design Specifications](#16-uiux-design-specifications)
17. [Error Handling & Edge Cases](#17-error-handling--edge-cases)
18. [Future Enhancements (Out of Scope for V1)](#18-future-enhancements-out-of-scope-for-v1)

---

## 1. Project Overview

### What Is This?

A web-based management UI deployed on Vercel that connects to GitHub repositories following a specific NetSuite development structure. The user selects a repo, and the app dynamically loads and displays all dashboards, modules, scripts, reference docs, dependency maps, and standards from that repo.

### Core Requirements

- **Dynamic repo selection** — same app, point at any repo that follows the structure
- **Read the repo via GitHub API** — no local clone needed
- **Render markdown files** as rich formatted content
- **Parse structured markdown tables** into interactive UI components
- **Visualize script dependencies** as an interactive graph
- **Show module catalog** as browseable cards with "used by" relationships
- **File browser** with folder tree navigation
- **Script viewer** with syntax highlighting, showing only latest versions by default
- **"Analyze All Scripts"** action button that triggers a scan of latest-version scripts
- **Responsive desktop-first layout** (this is a dev tool, not a mobile app)

### Who Uses This?

A single NetSuite developer (the repo owner) who wants a visual overview of their entire NetSuite codebase, modules, and dependency relationships without having to open each markdown file manually.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Vercel (Next.js App)                 │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │  Repo Picker │  │  Dashboard  │  │  File Viewer  │ │
│  │  (Landing)   │  │  (Main UI)  │  │  (Detail)     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘ │
│         │                │                 │          │
│         ▼                ▼                 ▼          │
│  ┌──────────────────────────────────────────────────┐ │
│  │           GitHub API Service Layer               │ │
│  │   (Octokit — fetches repo tree, file contents)   │ │
│  └──────────────────────┬───────────────────────────┘ │
│                         │                             │
│  ┌──────────────────────┴───────────────────────────┐ │
│  │         Markdown Parsing Engine                   │ │
│  │  (Parses tables, extracts structured data,        │ │
│  │   renders formatted content)                      │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   GitHub REST API     │
              │   (repos, contents,   │
              │    trees, blobs)      │
              └───────────────────────┘
```

### Key Design Decision: Client-Side vs Server-Side

Use **Next.js API routes** (server-side) to call the GitHub API. This keeps the GitHub token on the server and avoids CORS/rate-limit issues on the client. The frontend fetches data from these internal API routes.

```
Browser → Next.js API Route → GitHub API → Response → Browser
```

---

## 3. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Vercel-native, API routes, server components |
| Language | **TypeScript** | Type safety for parsed data structures |
| Styling | **Tailwind CSS** | Fast utility-first styling, dark mode support |
| UI Components | **shadcn/ui** | High-quality, composable components built on Radix |
| GitHub API | **Octokit (@octokit/rest)** | Official GitHub SDK |
| Markdown Rendering | **react-markdown + remark-gfm** | Renders GFM tables, code blocks, etc. |
| Markdown Table Parsing | **Custom parser** (see Section 9) | Extracts table data into typed arrays |
| Syntax Highlighting | **Shiki** or **react-syntax-highlighter** | For .js script viewing |
| Dependency Graph | **@xyflow/react** (React Flow) | Interactive node/edge graph visualization |
| Icons | **Lucide React** | Clean icon set, pairs with shadcn |
| State Management | **React Context + URL params** | Repo selection in URL, local state for UI |
| Deployment | **Vercel** | Zero-config Next.js deployment |

---

## 4. Data Source: Repo Structure

The app expects repos to follow this exact structure. The app should gracefully handle missing folders/files (show empty state, not crash).

```
{repo}/
├── _inbox/                     # Watch folder
│   └── README.md
├── reference/                  # Living reference docs
│   ├── internal-ids.md
│   ├── list-records.md
│   ├── permissions.md
│   ├── sales-order-lifecycle.md
│   └── record-lifecycles.md
├── standards/                  # Design & build standards
│   ├── branding.md
│   ├── ui-patterns.md
│   ├── inline-editing.md
│   ├── buttons-and-actions.md
│   ├── scripting-standards.md
│   └── versioning.md
├── dashboards/                 # Isolated dashboards
│   └── {dashboard-name}/
│       ├── README.md
│       └── scripts/
├── modules/                    # Reusable components
│   ├── MODULE-CATALOG.md
│   └── {module-name}/
│       └── README.md
├── scripts/                    # Shared scripts by type
│   ├── README.md
│   ├── client/
│   ├── user-event/
│   ├── scheduled/
│   ├── suitelet/
│   ├── restlet/
│   ├── map-reduce/
│   └── workflow-action/
├── maps/                       # Relationship tracking
│   ├── script-dependencies.md
│   ├── field-usage.md
│   └── dashboard-relationships.md
└── .claude/
    └── instructions.md
```

### Version Detection Pattern

Scripts follow the naming pattern: `{type}_{name}_v{NNN}.js`

To find the "latest version" of a script:
1. Group files by name prefix (everything before `_v{NNN}`)
2. Sort by version number descending
3. The highest `v{NNN}` is the current/active version

Example: `ce_order_validation_v001.js`, `ce_order_validation_v002.js`, `ce_order_validation_v003.js` → latest is `v003`.

---

## 5. Application Pages & Views

### Page 1: Repo Selector (Landing Page)

**Route:** `/`

**Purpose:** User selects which GitHub repo to load.

**Layout:**
```
┌─────────────────────────────────────────────────┐
│          NetSuite Dashboard Manager              │
│                                                  │
│    ┌──────────────────────────────────────────┐  │
│    │  GitHub Owner / Org:  [____________]     │  │
│    │                                          │  │
│    │  Repository:          [____________]     │  │
│    │                                          │  │
│    │  Branch:              [main ▼      ]     │  │
│    │                                          │  │
│    │            [ Load Repository ]            │  │
│    └──────────────────────────────────────────┘  │
│                                                  │
│    Recent Repos:                                 │
│    • gharrison91/NetSuite-Dashboards (main)      │
│    • gharrison91/NetSuite-Dashboards-v2 (main)   │
└─────────────────────────────────────────────────┘
```

**Behavior:**
- Text inputs for owner and repo name (or a single input: `owner/repo`)
- Branch selector dropdown (defaults to `main`, fetches available branches via API)
- "Load Repository" validates the repo exists and follows the expected structure
- Recent repos stored in `localStorage` for quick re-access
- On load, navigates to `/dashboard?repo=owner/repo&branch=main`

---

### Page 2: Main Dashboard (Overview)

**Route:** `/dashboard?repo={owner/repo}&branch={branch}`

**Purpose:** Central hub showing the full state of the repo.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [← Back] NetSuite Dashboard Manager    owner/repo @ branch  │
├────────────┬────────────────────────────────────────────────┤
│            │                                                │
│  Sidebar   │   Main Content Area                           │
│            │                                                │
│  Overview  │   ┌──────────┬───────────┬──────────┐         │
│  Dashbds   │   │ Modules  │  Scripts  │  Fields  │  KPIs   │
│  Modules   │   │    12    │    47     │   183    │         │
│  Scripts   │   └──────────┴───────────┴──────────┘         │
│  Reference │                                                │
│  Standards │   Module Catalog (cards)                       │
│  Maps      │   ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  Inbox     │   │ Plant   │ │ Order   │ │ Mfg     │        │
│            │   │ Capacity│ │ Pipeline│ │ Sched.  │        │
│  ────────  │   │ v002    │ │ v001    │ │ v003    │        │
│  Settings  │   │ Used: 3 │ │ Used: 2 │ │ Used: 1 │        │
│            │   └─────────┘ └─────────┘ └─────────┘        │
│            │                                                │
│            │   Recent Script Changes                        │
│            │   ┌──────────────────────────────────┐        │
│            │   │ ce_order_val_v003.js   2 hrs ago │        │
│            │   │ ue_fulfill_v002.js    yesterday  │        │
│            │   └──────────────────────────────────┘        │
│            │                                                │
│            │   [ Analyze All Scripts & Dependencies ]       │
│            │                                                │
└────────────┴────────────────────────────────────────────────┘
```

**Sidebar Navigation Items:**
| Item | What It Shows |
|---|---|
| Overview | The main dashboard (this page) with KPIs and quick access |
| Dashboards | List of all dashboards in `dashboards/`, click to expand |
| Modules | Module catalog cards parsed from `MODULE-CATALOG.md` |
| Scripts | Script browser organized by type, with version grouping |
| Reference | Rendered markdown for each file in `reference/` |
| Standards | Rendered markdown for each file in `standards/` |
| Maps | Interactive dependency graph + rendered map files |
| Inbox | Contents of `_inbox/`, shows pending scripts |
| Settings | GitHub connection settings, theme toggle |

**KPI Cards (Top of Overview):**
These are computed by scanning the repo tree:
- **Modules**: Count of directories in `modules/` (excluding `_template`)
- **Scripts**: Count of `.js` files across all script locations (latest versions only)
- **Scripts (All Versions)**: Total `.js` file count including old versions
- **Dashboards**: Count of directories in `dashboards/` (excluding `_template`)
- **Fields Tracked**: Count of rows in `reference/internal-ids.md` tables
- **Inbox Items**: Count of files in `_inbox/` (excluding README.md)

---

### Page 3: Dashboards View

**Route:** `/dashboard?repo=...&view=dashboards`

**Layout:**
```
┌────────────────────────────────────────────────────┐
│ Dashboards                                          │
│                                                     │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │  Executive   │ │  Shipping    │ │  Manufacturing│ │
│ │              │ │              │ │               │ │
│ │ Modules: 4   │ │ Modules: 2   │ │ Modules: 3   │ │
│ │ Scripts: 8   │ │ Scripts: 5   │ │ Scripts: 6   │ │
│ │ Status: ●    │ │ Status: ●    │ │ Status: ●    │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
│                                                     │
│ Click a dashboard to see its README, scripts,       │
│ modules, and field references.                      │
└────────────────────────────────────────────────────┘
```

**Dashboard Detail View (on click):**
- Renders the dashboard's `README.md` as formatted content
- Lists scripts in the dashboard's `scripts/` subfolder
- Shows which modules it uses (parsed from the README table)
- Shows which shared scripts it depends on (parsed from README table)
- Link to view this dashboard's scripts in the dependency graph

---

### Page 4: Modules View

**Route:** `/dashboard?repo=...&view=modules`

Parses `modules/MODULE-CATALOG.md` and renders each module as a card.

**Module Card:**
```
┌──────────────────────────────┐
│ 🏭 Plant Capacity            │
│                              │
│ Real-time plant capacity     │
│ visualization                │
│                              │
│ Version: v002                │
│ Status:  ● Active            │
│                              │
│ Used by:                     │
│ • Executive Dashboard        │
│ • Manufacturing Dashboard    │
│                              │
│ [View Details] [View Code]   │
└──────────────────────────────┘
```

**Module Detail View (on click):**
- Renders the module's `README.md`
- Lists scripts within the module folder
- Shows the "Quick Reference" code snippet from the README
- Shows which dashboards use it
- Shows dependencies
- Shows version history

---

### Page 5: Scripts View

**Route:** `/dashboard?repo=...&view=scripts`

**Layout:**
```
┌───────────────────────────────────────────────────────────┐
│ Scripts                              [Show All Versions ▼] │
│                                                            │
│ ┌─ Client Scripts (3) ──────────────────────────────────┐  │
│ │ ce_order_validation      v003  ← latest               │  │
│ │ ce_so_field_defaults     v001                          │  │
│ │ ce_fulfillment_ui        v002  ← latest               │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                            │
│ ┌─ User Event Scripts (5) ──────────────────────────────┐  │
│ │ ue_so_post_process       v002  ← latest               │  │
│ │ ue_auto_fulfill          v001                          │  │
│ │ ...                                                    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                            │
│ ┌─ Suitelets (2) ──────────────────────────────────────┐   │
│ │ sl_shipping_dashboard    v001                         │   │
│ │ sl_exec_dashboard        v003  ← latest              │   │
│ └───────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

**Key Behaviors:**
- **Default: show latest versions only.** Group scripts by base name, show highest `v{NNN}`.
- **"Show All Versions" toggle** expands to show every version file, with the latest highlighted.
- Scripts are grouped by SuiteScript type (collapsible sections).
- Also includes scripts found inside `dashboards/*/scripts/` and `modules/*/` — labeled with their location.
- Click a script to open the Script Detail View.

**Script Detail View:**
- Syntax-highlighted source code (fetched via GitHub API)
- Parsed JSDoc header displayed as metadata cards (description, version, dependencies, dashboards, modules)
- "Dependency" section showing related scripts (from `maps/script-dependencies.md`)
- "Fields Used" section (from `maps/field-usage.md`)
- Version history: list of all versions of this script with timestamps from git

---

### Page 6: Reference View

**Route:** `/dashboard?repo=...&view=reference`

- Left: list of files in `reference/`
- Right: rendered markdown of the selected file
- Tables in markdown are rendered as proper HTML tables with sorting and filtering
- The `internal-ids.md` file should render its tables with a search/filter box at the top (these tables will get large)

---

### Page 7: Standards View

**Route:** `/dashboard?repo=...&view=standards`

Same pattern as Reference View:
- Left: list of files in `standards/`
- Right: rendered markdown content
- Code blocks in the styling standards render with syntax highlighting

---

### Page 8: Maps View (Dependency Graph)

**Route:** `/dashboard?repo=...&view=maps`

This is the most complex view. It has two sub-views:

**Sub-view A: Interactive Dependency Graph**

Uses React Flow to render `maps/script-dependencies.md` as a visual graph.

```
┌────────────────────────────────────────────────────────────┐
│ Script Dependency Graph                    [Fit] [Reset]   │
│                                                            │
│    ┌──────────────┐         ┌──────────────────┐           │
│    │ ce_so_valid  │──calls──│ ue_so_post_proc  │           │
│    │ (Client)     │         │ (User Event)     │           │
│    │ v003         │         │ v002             │           │
│    └──────────────┘         └────────┬─────────┘           │
│                                      │                     │
│                                  triggers                  │
│                                      │                     │
│                                      ▼                     │
│                             ┌──────────────────┐           │
│                             │ sc_nightly_sync  │           │
│                             │ (Scheduled)      │           │
│                             │ v001             │           │
│                             └──────────────────┘           │
│                                                            │
│ Legend:                                                     │
│ ── calls    ── triggers    ── depends on    ── shares data │
└────────────────────────────────────────────────────────────┘
```

**Node colors by script type:**
| Type | Color |
|---|---|
| Client Script | Blue |
| User Event | Green |
| Suitelet | Purple |
| RESTlet | Orange |
| Scheduled | Yellow |
| Map/Reduce | Red |
| Workflow Action | Teal |

**Edge styles by relationship:**
| Relationship | Style |
|---|---|
| Calls | Solid line, arrow |
| Triggers | Dashed line, arrow |
| Depends On | Dotted line, arrow |
| Shares Data | Dotted line, no arrow (bidirectional) |

**Node click** → opens the Script Detail View for that script.

**Sub-view B: Raw Maps**

Tabbed rendered markdown for each file in `maps/`:
- `script-dependencies.md`
- `field-usage.md`
- `dashboard-relationships.md`

---

### Page 9: Inbox View

**Route:** `/dashboard?repo=...&view=inbox`

Shows the contents of `_inbox/` folder.

```
┌─────────────────────────────────────────────────┐
│ Script Inbox                    3 items pending  │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ 📄 some_script.js           12 KB   2 hrs ago│ │
│ │ 📄 another_one.js            8 KB   yesterday│ │
│ │ 📄 bulk_update.js           15 KB   3 days   │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Click a file to preview its contents.            │
│                                                  │
│ To process these files, use Claude Code:         │
│ "Process the inbox and sort all scripts"         │
└─────────────────────────────────────────────────┘
```

- Lists files in `_inbox/` (excluding `README.md`)
- Click to preview file contents with syntax highlighting
- File metadata: size, last modified (from git)
- Count badge in sidebar navigation

---

## 6. Component Specifications

### Reusable Components to Build

| Component | Props | Used In |
|---|---|---|
| `RepoSelector` | `onSelect(owner, repo, branch)` | Landing page |
| `Sidebar` | `currentView, repoData` | All pages (except landing) |
| `KpiCard` | `label, value, icon, trend?` | Overview |
| `ModuleCard` | `module: Module` | Overview, Modules view |
| `ScriptListItem` | `script: Script, showAllVersions` | Scripts view |
| `ScriptViewer` | `content: string, language: string` | Script detail |
| `MarkdownRenderer` | `content: string, enableTableParsing?` | Reference, Standards, READMEs |
| `ParsedTable` | `headers: string[], rows: string[][], searchable?` | Reference (internal-ids), Maps |
| `DependencyGraph` | `nodes: GraphNode[], edges: GraphEdge[]` | Maps view |
| `FileTree` | `tree: TreeNode[]` | File browser panel |
| `VersionBadge` | `version: string, isLatest: boolean` | Scripts, Modules |
| `StatusBadge` | `status: 'active' \| 'deprecated' \| 'pending'` | Modules, Dashboards |
| `BreadcrumbNav` | `path: string[]` | Detail views |
| `SearchFilter` | `onFilter(term), placeholder` | Tables, script lists |
| `CollapsibleSection` | `title, count, children` | Script type groups |
| `InboxItem` | `file: InboxFile` | Inbox view |
| `EmptyState` | `title, description, icon` | Any view with no data |

### Sidebar Specification

```typescript
interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  view: string;
  badge?: number;        // e.g., inbox count
  children?: SidebarItem[]; // expandable sub-items (e.g., individual dashboards)
}
```

The sidebar should:
- Highlight the current active view
- Show badge counts where relevant (inbox items, total scripts)
- Expand/collapse dashboard and script type sub-items
- Be collapsible on narrower viewports (hamburger menu)

---

## 7. Data Models & Types

```typescript
// ── Repo ──
interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

// ── Module ──
interface Module {
  name: string;              // directory name
  displayName: string;       // from README title
  purpose: string;           // from catalog table
  currentVersion: string;    // e.g., "v002"
  status: 'Active' | 'Deprecated' | 'Draft';
  usedByDashboards: string[];
  readmePath: string;        // path in repo
  scripts: Script[];
}

// ── Script ──
interface Script {
  filename: string;          // e.g., "ce_order_validation_v003.js"
  baseName: string;          // e.g., "ce_order_validation"
  type: ScriptType;
  version: string;           // e.g., "v003"
  isLatest: boolean;
  path: string;              // full path in repo
  location: ScriptLocation;
  // Parsed from JSDoc header (if available):
  description?: string;
  lastModified?: string;
  dependencies?: string[];
  dashboards?: string[];
  modules?: string[];
}

type ScriptType =
  | 'client'
  | 'user-event'
  | 'scheduled'
  | 'suitelet'
  | 'restlet'
  | 'map-reduce'
  | 'workflow-action'
  | 'unknown';

interface ScriptLocation {
  type: 'shared' | 'dashboard' | 'module';
  parent?: string; // dashboard or module name
}

// ── Dashboard ──
interface Dashboard {
  name: string;              // directory name
  displayName: string;       // from README title
  readmePath: string;
  scripts: Script[];
  modulesUsed: string[];     // module names
  sharedScripts: string[];   // script filenames
  fieldsReferenced: FieldReference[];
}

// ── Dependency Graph ──
interface GraphNode {
  id: string;                // script baseName
  label: string;
  type: ScriptType;
  version: string;
  location: ScriptLocation;
}

interface GraphEdge {
  source: string;            // node id
  target: string;            // node id
  relationship: 'calls' | 'triggers' | 'depends_on' | 'shares_data';
  details?: string;
}

// ── Field Reference ──
interface FieldReference {
  internalId: string;
  label: string;
  record: string;
  usedByScripts: string[];
  usedByDashboards: string[];
  usedByModules: string[];
  readWrite: 'Read' | 'Write' | 'R/W';
}

// ── Inbox ──
interface InboxFile {
  name: string;
  path: string;
  size: number;
  sha: string;              // git SHA for fetching content
}

// ── File Tree ──
interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}
```

---

## 8. GitHub API Integration

### API Routes to Build (Next.js API Routes)

All routes accept `owner`, `repo`, and `branch` as query parameters.

| Route | Purpose | GitHub API Used |
|---|---|---|
| `GET /api/repo/validate` | Check if repo exists and has expected structure | `GET /repos/{owner}/{repo}` + `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` |
| `GET /api/repo/tree` | Full repo file tree | `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` |
| `GET /api/repo/file` | Single file contents | `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` |
| `GET /api/repo/branches` | List branches | `GET /repos/{owner}/{repo}/branches` |
| `GET /api/repo/directory` | List files in a directory | `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` |

### Octokit Setup

```typescript
// lib/github.ts
import { Octokit } from '@octokit/rest';

export function getOctokit() {
  return new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
}
```

### Caching Strategy

- **Repo tree**: Cache for 5 minutes (it's the most-called endpoint)
- **File contents**: Cache for 2 minutes (files change less frequently during a session)
- **Branches**: Cache for 10 minutes
- Use Next.js `fetch` with `next: { revalidate: N }` or a simple in-memory cache in the API routes
- Add a "Refresh" button in the UI header that busts the cache

### Rate Limiting

- GitHub API: 5,000 requests/hour with authentication
- The recursive tree endpoint is the most efficient — one call gets the entire repo structure
- Fetch individual files on-demand (when the user clicks into a view), not all at once
- Show rate limit remaining in the UI footer: `API: 4,832 / 5,000`

### Batch File Loading

When a view needs multiple files (e.g., Overview needs MODULE-CATALOG.md + script-dependencies.md + field-usage.md), fetch them in parallel using `Promise.all()`.

---

## 9. Markdown Parsing Engine

This is critical. The repo stores structured data in markdown tables. The app needs to parse these tables into typed data structures.

### What Needs Parsing

| File | What to Extract |
|---|---|
| `modules/MODULE-CATALOG.md` | Module table → `Module[]` |
| `maps/script-dependencies.md` | Dependency table → `GraphEdge[]`, Cross-dashboard table |
| `maps/field-usage.md` | Field-to-script table → `FieldReference[]`, High-impact table |
| `maps/dashboard-relationships.md` | Module matrix, Script matrix |
| `reference/internal-ids.md` | All tables → searchable/filterable data |
| Any `README.md` | Tables within → rendered as interactive tables |

### Parsing Approach

```typescript
// lib/markdown-parser.ts

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/**
 * Extract all markdown tables from a markdown string.
 * Handles GFM pipe tables with alignment rows.
 */
function extractTables(markdown: string): ParsedTable[] {
  // 1. Split by lines
  // 2. Identify table blocks (lines starting with |)
  // 3. First row = headers
  // 4. Second row = alignment (skip)
  // 5. Remaining rows = data
  // 6. Strip leading/trailing pipes, trim cells
  // 7. Skip rows that are entirely HTML comments (<!-- -->)
}

/**
 * Parse MODULE-CATALOG.md into Module objects.
 */
function parseModuleCatalog(markdown: string): Module[] {
  // Find the "Available Modules" table
  // Map rows to Module objects
  // Skip rows where all cells are HTML comments (template rows)
}

/**
 * Parse script-dependencies.md into graph edges.
 */
function parseDependencies(markdown: string): GraphEdge[] {
  // Find the "Dependency Table"
  // Map rows to GraphEdge objects
  // Skip HTML comment rows
}

/**
 * Parse field-usage.md into FieldReference objects.
 */
function parseFieldUsage(markdown: string): FieldReference[] {
  // Find the "Field-to-Script Mapping" table
  // Map rows to FieldReference objects
  // Skip HTML comment rows
}
```

### Handling HTML Comments in Tables

The template tables use `<!-- placeholder -->` in cells. The parser must:
1. Detect if a row's cells are ALL HTML comments → skip the row entirely (it's a template)
2. Detect if individual cells contain HTML comments → treat as empty/null
3. Strip `<!-- -->` wrapper from any cell values that are actual data mixed with comments

### Markdown Rendering

For general markdown rendering (READMEs, reference docs, standards), use `react-markdown` with these plugins:
- `remark-gfm` — tables, strikethrough, task lists
- `rehype-highlight` or `rehype-shiki` — code block syntax highlighting

Override the default `table` renderer to use the `ParsedTable` component (with sorting/filtering) instead of plain HTML tables.

---

## 10. Dependency Graph Visualization

### Building the Graph from Data

```typescript
// lib/graph-builder.ts

function buildDependencyGraph(
  dependencies: GraphEdge[],
  scripts: Script[]
): { nodes: GraphNode[], edges: GraphEdge[] } {
  // 1. Collect all unique script names from edges (source + target)
  // 2. Look up each script in the scripts array to get type, version, location
  // 3. Create GraphNode for each
  // 4. Return nodes and edges for React Flow
}
```

### React Flow Configuration

```typescript
// Node types by ScriptType
const nodeColors: Record<ScriptType, string> = {
  'client': '#3B82F6',       // blue
  'user-event': '#22C55E',   // green
  'suitelet': '#A855F7',     // purple
  'restlet': '#F97316',      // orange
  'scheduled': '#EAB308',    // yellow
  'map-reduce': '#EF4444',   // red
  'workflow-action': '#14B8A6', // teal
  'unknown': '#6B7280',      // gray
};

// Edge types by relationship
const edgeStyles: Record<string, object> = {
  'calls': { stroke: '#333', strokeDasharray: 'none' },
  'triggers': { stroke: '#333', strokeDasharray: '5,5' },
  'depends_on': { stroke: '#999', strokeDasharray: '2,2' },
  'shares_data': { stroke: '#999', strokeDasharray: '2,2', markerEnd: 'none' },
};
```

### Layout

Use the `dagre` layout algorithm (via `@dagrejs/dagre`) for automatic node positioning:
- Direction: top-to-bottom
- Node spacing: 80px horizontal, 100px vertical
- Fit to viewport on initial load

### Interactivity

- **Pan and zoom** (built into React Flow)
- **Click node** → highlight connected nodes and edges, dim others
- **Click node label** → navigate to Script Detail View
- **Hover edge** → show relationship tooltip ("triggers: Client save triggers UE afterSubmit")
- **Fit button** → fit all nodes in viewport
- **Reset button** → reset zoom and position
- **Filter** → dropdown to show only specific script types or dashboards
- **Legend** → fixed bottom-left, shows color and line-style meanings

---

## 11. Analyze All Scripts Feature

### What It Does

When the user clicks "Analyze All Scripts & Dependencies", the app:

1. Scans the repo tree for all `.js` files
2. **Filters to latest versions only** (highest `v{NNN}` per base name)
3. Fetches the content of each latest-version script
4. Parses the JSDoc headers to extract metadata
5. Builds/rebuilds the dependency data, field usage data, and script index
6. Displays results in a report view

### Implementation

This is a **client-side batch operation** that calls the API routes:

```typescript
async function analyzeAllScripts(repoConfig: RepoConfig): Promise<AnalysisResult> {
  // 1. Fetch repo tree
  const tree = await fetchTree(repoConfig);

  // 2. Find all .js files
  const jsFiles = tree.filter(f => f.path.endsWith('.js'));

  // 3. Group by base name, keep latest version
  const latestScripts = getLatestVersions(jsFiles);

  // 4. Fetch content for each (batch in groups of 10 to avoid rate limits)
  const contents = await batchFetchContents(latestScripts, repoConfig);

  // 5. Parse JSDoc headers
  const parsed = contents.map(parseJsDocHeader);

  // 6. Build analysis report
  return {
    totalScripts: jsFiles.length,
    latestVersionsAnalyzed: latestScripts.length,
    scriptsByType: groupByType(parsed),
    dependencies: extractDependencies(parsed),
    fieldsReferenced: extractFields(parsed),
    warnings: findIssues(parsed), // missing headers, orphaned scripts, etc.
  };
}
```

### JSDoc Header Parser

```typescript
interface ParsedJsDoc {
  apiVersion?: string;      // @NApiVersion
  scriptType?: string;      // @NScriptType
  description?: string;     // @description
  version?: string;         // @version
  lastModified?: string;    // @lastModified
  dependencies?: string[];  // @dependencies (comma-separated)
  dashboards?: string[];    // @dashboards (comma-separated)
  modules?: string[];       // @modules (comma-separated)
}

function parseJsDocHeader(content: string): ParsedJsDoc {
  // Extract the first block comment (/** ... */)
  // Parse each @tag line
  // Return structured object
}
```

### Analysis Report View

```
┌─────────────────────────────────────────────────────┐
│ Script Analysis Report                  Feb 17 2026  │
│                                                      │
│ Scanned: 47 scripts (latest versions only)           │
│ Total versions in repo: 127                          │
│                                                      │
│ By Type:                                             │
│   Client Scripts:      12                            │
│   User Event:          15                            │
│   Suitelets:            8                            │
│   Scheduled:            4                            │
│   Map/Reduce:           3                            │
│   RESTlets:             3                            │
│   Workflow Actions:     2                            │
│                                                      │
│ Warnings:                                            │
│   ⚠ 3 scripts missing JSDoc headers                 │
│   ⚠ 2 scripts not listed in maps/field-usage.md     │
│   ⚠ 1 script references unknown field ID            │
│                                                      │
│ Dependencies Found: 23 relationships                 │
│ Fields Referenced: 89 unique fields                  │
│                                                      │
│ [View Dependency Graph] [View Full Report]           │
└─────────────────────────────────────────────────────┘
```

---

## 12. File Structure (Next.js App)

```
netsuite-dashboard-ui/
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout with providers
│   │   ├── page.tsx                   # Landing page (Repo Selector)
│   │   ├── globals.css                # Tailwind base + custom vars
│   │   └── dashboard/
│   │       └── page.tsx               # Main dashboard (reads ?view= param)
│   │
│   ├── components/
│   │   ├── ui/                        # shadcn/ui components (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── breadcrumb-nav.tsx
│   │   ├── repo/
│   │   │   ├── repo-selector.tsx
│   │   │   └── recent-repos.tsx
│   │   ├── overview/
│   │   │   ├── kpi-cards.tsx
│   │   │   ├── module-quick-view.tsx
│   │   │   └── recent-scripts.tsx
│   │   ├── dashboards/
│   │   │   ├── dashboard-list.tsx
│   │   │   └── dashboard-detail.tsx
│   │   ├── modules/
│   │   │   ├── module-catalog.tsx
│   │   │   ├── module-card.tsx
│   │   │   └── module-detail.tsx
│   │   ├── scripts/
│   │   │   ├── script-browser.tsx
│   │   │   ├── script-list-item.tsx
│   │   │   ├── script-viewer.tsx
│   │   │   ├── script-detail.tsx
│   │   │   └── version-badge.tsx
│   │   ├── reference/
│   │   │   └── reference-viewer.tsx
│   │   ├── standards/
│   │   │   └── standards-viewer.tsx
│   │   ├── maps/
│   │   │   ├── dependency-graph.tsx
│   │   │   ├── graph-node.tsx
│   │   │   ├── graph-legend.tsx
│   │   │   └── maps-viewer.tsx
│   │   ├── inbox/
│   │   │   ├── inbox-list.tsx
│   │   │   └── inbox-preview.tsx
│   │   ├── analysis/
│   │   │   ├── analyze-button.tsx
│   │   │   ├── analysis-progress.tsx
│   │   │   └── analysis-report.tsx
│   │   └── shared/
│   │       ├── markdown-renderer.tsx
│   │       ├── parsed-table.tsx
│   │       ├── search-filter.tsx
│   │       ├── collapsible-section.tsx
│   │       ├── status-badge.tsx
│   │       ├── empty-state.tsx
│   │       ├── loading-skeleton.tsx
│   │       └── file-tree.tsx
│   │
│   ├── lib/
│   │   ├── github.ts                  # Octokit setup and helpers
│   │   ├── markdown-parser.ts         # Table extraction and parsing
│   │   ├── jsdoc-parser.ts            # JSDoc header parsing
│   │   ├── version-utils.ts           # Version sorting, latest detection
│   │   ├── graph-builder.ts           # Dependency graph data builder
│   │   ├── repo-scanner.ts            # Scan repo tree, classify files
│   │   ├── script-analyzer.ts         # Analyze All Scripts logic
│   │   └── cache.ts                   # Simple in-memory cache for API responses
│   │
│   ├── hooks/
│   │   ├── use-repo.ts                # React context for current repo config
│   │   ├── use-repo-tree.ts           # Fetch and cache repo tree
│   │   ├── use-file-content.ts        # Fetch single file content
│   │   └── use-analysis.ts            # Analyze scripts state management
│   │
│   ├── types/
│   │   └── index.ts                   # All TypeScript interfaces (from Section 7)
│   │
│   └── api/
│       └── repo/
│           ├── validate/route.ts
│           ├── tree/route.ts
│           ├── file/route.ts
│           ├── branches/route.ts
│           └── directory/route.ts
│
├── .env.local                         # GITHUB_TOKEN
├── .gitignore
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 13. Environment Variables

```env
# .env.local (never committed)

# GitHub Personal Access Token
# Required scopes: repo (for private repos) or public_repo (for public repos)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Override the GitHub API URL (for GitHub Enterprise)
# GITHUB_API_URL=https://api.github.com
```

### Token Scopes Required

| Scope | Why |
|---|---|
| `repo` | Read private repo contents, tree, branches |
| `public_repo` | Read public repo contents (if repos are public) |

---

## 14. Authentication & Security

### V1 (Simple — Build This First)

- GitHub token stored in `.env.local` on the server
- No user authentication — this is a single-user dev tool
- API routes validate that the `owner/repo` exists before fetching
- No write operations — this app is read-only against GitHub

### V2 (If Multi-User Needed Later)

- GitHub OAuth login via NextAuth.js
- Each user's GitHub token stored in their session
- Users can only access repos they have access to

---

## 15. Deployment

### Vercel Setup

1. Create a new Vercel project
2. Connect it to the UI repo (NOT the NetSuite-Dashboards repo — this is a separate repo)
3. Set environment variables in Vercel project settings:
   - `GITHUB_TOKEN`
4. Deploy — Vercel auto-builds Next.js

### Vercel Configuration

```json
// vercel.json (optional — Vercel auto-detects Next.js)
{
  "framework": "nextjs"
}
```

### Domain

- Default: `netsuite-dashboard-ui.vercel.app` (or whatever Vercel assigns)
- Optional: custom domain via Vercel settings

---

## 16. UI/UX Design Specifications

### Color Scheme

Use a professional, dark-mode-first design (dev tool aesthetic):

| Element | Light Mode | Dark Mode |
|---|---|---|
| Background | `#FFFFFF` | `#0A0A0A` |
| Surface/Card | `#F8FAFC` | `#171717` |
| Border | `#E2E8F0` | `#2D2D2D` |
| Text Primary | `#0F172A` | `#FAFAFA` |
| Text Secondary | `#64748B` | `#A1A1AA` |
| Accent (Primary) | `#2563EB` | `#3B82F6` |
| Success | `#16A34A` | `#22C55E` |
| Warning | `#D97706` | `#F59E0B` |
| Danger | `#DC2626` | `#EF4444` |

### Typography

- Font: `Inter` (via `next/font/google`)
- Monospace (code): `JetBrains Mono` or `Fira Code`
- Scale: 12px (small), 14px (body), 16px (subtitle), 20px (title), 24px (page heading)

### Spacing

- Use Tailwind's spacing scale consistently
- Card padding: `p-6`
- Section gaps: `gap-6`
- Grid: 12-column grid for main layout

### Animations

- Keep it minimal — this is a dev tool, not a marketing site
- Subtle transitions on hover states (150ms ease)
- Collapsible sections: smooth height transition (200ms)
- Loading: skeleton shimmer on content areas
- Graph: smooth pan/zoom (handled by React Flow)

### Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `< 768px` | Not officially supported (show a message) |
| `768px – 1024px` | Sidebar collapses to icons, content fills width |
| `1024px – 1440px` | Standard layout |
| `> 1440px` | Max-width container, centered |

---

## 17. Error Handling & Edge Cases

### Cases to Handle

| Case | Behavior |
|---|---|
| Repo doesn't exist | Show error on landing page, don't navigate |
| Repo exists but wrong structure | Show warning: "This repo doesn't follow the expected structure. Some features may not work." Load what's available. |
| Missing folder (e.g., no `modules/`) | Show empty state in that view, don't crash |
| Empty markdown tables | Show "No data yet" in the table component |
| All table rows are HTML comments | Treat as empty table |
| Script with no JSDoc header | Show "No metadata" in script detail, flag in analysis |
| GitHub API rate limited | Show banner: "GitHub API rate limit reached. Resets at {time}." Disable refresh. |
| Network error | Show retry button with error message |
| File too large to display | Show first 500 lines with "File truncated" message |
| Repo is private + no token | Show clear error: "A GitHub token is required for private repos" |
| Branch doesn't exist | Show error on landing page branch selector |

### Loading States

Every data-fetching view should show a loading skeleton:
- KPI cards: gray shimmer boxes
- Module cards: gray shimmer cards
- Script lists: gray shimmer rows
- Markdown content: gray shimmer lines
- Dependency graph: centered spinner

---

## 18. Future Enhancements (Out of Scope for V1)

Document these in the UI repo's README but do NOT build them:

- **Claude API integration** — "Analyze" button calls Claude to read scripts and auto-generate dependency maps
- **Drag-and-drop inbox** — Drag files from desktop into the inbox view, auto-commits to `_inbox/`
- **Write-back to GitHub** — Edit reference docs, maps, or script metadata directly in the UI and commit back
- **Real-time collaboration** — Multiple users editing simultaneously
- **NetSuite API integration** — Pull field definitions, record types, and script deployments directly from a NetSuite instance
- **Diff viewer** — Compare two versions of a script side-by-side
- **Search across all files** — Full-text search across the entire repo
- **Webhooks** — Auto-refresh when the repo is updated (via GitHub webhooks)
- **Export** — Export dependency graph as PNG/SVG, export analysis report as PDF

---

## Build Order (Recommended)

Build in this order to have a working app at each stage:

| Phase | What to Build | Result |
|---|---|---|
| **1** | Project setup, landing page, GitHub API routes, repo tree fetching | Can select a repo and validate it |
| **2** | Sidebar, Overview page with KPI cards, file tree | Can see repo stats and navigate |
| **3** | Markdown renderer, Reference view, Standards view | Can read all docs |
| **4** | Scripts view with version grouping, Script detail with syntax highlighting | Can browse and read all scripts |
| **5** | Markdown table parser, Module catalog, Module cards | Can browse modules |
| **6** | Dashboards view, Dashboard detail | Can browse dashboards |
| **7** | Dependency graph (React Flow), Maps view | Can visualize relationships |
| **8** | Inbox view | Can see pending scripts |
| **9** | Analyze All Scripts feature | Can run full analysis |
| **10** | Polish: dark mode toggle, loading skeletons, error handling, caching | Production-ready |
