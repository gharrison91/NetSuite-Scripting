import { RepoStats, Script, TreeNode } from '@/types';
import { parseScriptFromPath, groupAndMarkLatest, buildTreeFromPaths } from './version-utils';

interface GitTreeItem {
  path?: string;
  type?: string;
  size?: number;
  sha?: string;
}

export function scanRepoTree(treeItems: GitTreeItem[]): {
  tree: TreeNode[];
  scripts: Script[];
  stats: RepoStats;
} {
  const tree = buildTreeFromPaths(
    treeItems
      .filter((item) => item.path)
      .map((item) => ({
        path: item.path!,
        type: item.type || 'blob',
        size: item.size,
        sha: item.sha,
      }))
  );

  // Parse all scripts
  const allScripts: Script[] = [];
  for (const item of treeItems) {
    if (!item.path || !item.path.endsWith('.js')) continue;
    const script = parseScriptFromPath(item.path);
    if (script) allScripts.push(script);
  }
  const scripts = groupAndMarkLatest(allScripts);

  // Calculate stats
  const moduleDirs = new Set<string>();
  const dashboardDirs = new Set<string>();
  let inboxCount = 0;

  for (const item of treeItems) {
    if (!item.path) continue;

    // Count module directories
    const moduleMatch = item.path.match(/^modules\/([^/]+)\/?$/);
    if (moduleMatch && item.type === 'tree' && moduleMatch[1] !== '_template') {
      moduleDirs.add(moduleMatch[1]);
    }

    // Count dashboard directories
    const dashMatch = item.path.match(/^dashboards\/([^/]+)\/?$/);
    if (dashMatch && item.type === 'tree' && dashMatch[1] !== '_template') {
      dashboardDirs.add(dashMatch[1]);
    }

    // Count inbox items
    if (item.path.startsWith('_inbox/') && item.type === 'blob' && !item.path.endsWith('README.md')) {
      inboxCount++;
    }
  }

  const latestScripts = scripts.filter((s) => s.isLatest);

  const stats: RepoStats = {
    moduleCount: moduleDirs.size,
    scriptCount: latestScripts.length,
    scriptAllVersionsCount: scripts.length,
    dashboardCount: dashboardDirs.size,
    fieldsTracked: 0, // Will be set after parsing field-usage.md
    inboxCount,
  };

  return { tree, scripts, stats };
}
