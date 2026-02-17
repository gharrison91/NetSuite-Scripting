// ── Repo ──
export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

// ── Module ──
export interface Module {
  name: string;
  displayName: string;
  purpose: string;
  currentVersion: string;
  status: 'Active' | 'Deprecated' | 'Draft';
  usedByDashboards: string[];
  readmePath: string;
  scripts: Script[];
}

// ── Script ──
export interface Script {
  filename: string;
  baseName: string;
  type: ScriptType;
  version: string;
  isLatest: boolean;
  path: string;
  location: ScriptLocation;
  description?: string;
  lastModified?: string;
  dependencies?: string[];
  dashboards?: string[];
  modules?: string[];
}

export type ScriptType =
  | 'client'
  | 'user-event'
  | 'scheduled'
  | 'suitelet'
  | 'restlet'
  | 'map-reduce'
  | 'workflow-action'
  | 'unknown';

export interface ScriptLocation {
  type: 'shared' | 'dashboard' | 'module';
  parent?: string;
}

// ── Dashboard ──
export interface Dashboard {
  name: string;
  displayName: string;
  readmePath: string;
  scripts: Script[];
  modulesUsed: string[];
  sharedScripts: string[];
  fieldsReferenced: FieldReference[];
}

// ── Dependency Graph ──
export interface GraphNode {
  id: string;
  label: string;
  type: ScriptType;
  version: string;
  location: ScriptLocation;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: 'calls' | 'triggers' | 'depends_on' | 'shares_data';
  details?: string;
}

// ── Field Reference ──
export interface FieldReference {
  internalId: string;
  label: string;
  record: string;
  usedByScripts: string[];
  usedByDashboards: string[];
  usedByModules: string[];
  readWrite: 'Read' | 'Write' | 'R/W';
}

// ── Inbox ──
export interface InboxFile {
  name: string;
  path: string;
  size: number;
  sha: string;
}

// ── File Tree ──
export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  size?: number;
  sha?: string;
}

// ── Analysis ──
export interface AnalysisResult {
  totalScripts: number;
  latestVersionsAnalyzed: number;
  scriptsByType: Record<ScriptType, number>;
  dependencies: GraphEdge[];
  fieldsReferenced: FieldReference[];
  warnings: AnalysisWarning[];
}

export interface AnalysisWarning {
  type: 'missing_header' | 'not_in_maps' | 'unknown_field' | 'orphaned_script';
  scriptName: string;
  message: string;
}

// ── Parsed JSDoc ──
export interface ParsedJsDoc {
  apiVersion?: string;
  scriptType?: string;
  description?: string;
  version?: string;
  lastModified?: string;
  dependencies?: string[];
  dashboards?: string[];
  modules?: string[];
}

// ── Parsed Table ──
export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

// ── Sidebar ──
export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  view: string;
  badge?: number;
  children?: SidebarItem[];
}

// ── Repo Stats ──
export interface RepoStats {
  moduleCount: number;
  scriptCount: number;
  scriptAllVersionsCount: number;
  dashboardCount: number;
  fieldsTracked: number;
  inboxCount: number;
}
