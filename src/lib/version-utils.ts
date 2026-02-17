import { Script, ScriptType, ScriptLocation, TreeNode } from '@/types';

const VERSION_REGEX = /_v(\d{3})\.js$/;
const SCRIPT_TYPE_PREFIXES: Record<string, ScriptType> = {
  'ce_': 'client',
  'cs_': 'client',
  'ue_': 'user-event',
  'sl_': 'suitelet',
  'rl_': 'restlet',
  'sc_': 'scheduled',
  'ss_': 'scheduled',
  'mr_': 'map-reduce',
  'wa_': 'workflow-action',
};

const SCRIPT_TYPE_FOLDERS: Record<string, ScriptType> = {
  'client': 'client',
  'user-event': 'user-event',
  'scheduled': 'scheduled',
  'suitelet': 'suitelet',
  'restlet': 'restlet',
  'map-reduce': 'map-reduce',
  'workflow-action': 'workflow-action',
};

export function parseVersion(filename: string): string | null {
  const match = filename.match(VERSION_REGEX);
  return match ? `v${match[1]}` : null;
}

export function getBaseName(filename: string): string {
  return filename.replace(VERSION_REGEX, '').replace(/\.js$/, '');
}

export function inferScriptType(filename: string, path: string): ScriptType {
  // Check folder-based type first
  for (const [folder, type] of Object.entries(SCRIPT_TYPE_FOLDERS)) {
    if (path.includes(`/scripts/${folder}/`) || path.includes(`scripts/${folder}/`)) {
      return type;
    }
  }
  // Check prefix-based type
  for (const [prefix, type] of Object.entries(SCRIPT_TYPE_PREFIXES)) {
    if (filename.startsWith(prefix)) {
      return type;
    }
  }
  return 'unknown';
}

export function inferScriptLocation(path: string): ScriptLocation {
  if (path.startsWith('dashboards/')) {
    const parts = path.split('/');
    return { type: 'dashboard', parent: parts[1] };
  }
  if (path.startsWith('modules/')) {
    const parts = path.split('/');
    return { type: 'module', parent: parts[1] };
  }
  return { type: 'shared' };
}

export function parseScriptFromPath(path: string): Script | null {
  const filename = path.split('/').pop() || '';
  if (!filename.endsWith('.js')) return null;

  const version = parseVersion(filename) || 'v001';
  const baseName = getBaseName(filename);
  const type = inferScriptType(filename, path);
  const location = inferScriptLocation(path);

  return {
    filename,
    baseName,
    type,
    version,
    isLatest: false, // will be set later
    path,
    location,
  };
}

export function groupAndMarkLatest(scripts: Script[]): Script[] {
  const groups: Record<string, Script[]> = {};
  for (const script of scripts) {
    const key = `${script.baseName}__${script.location.type}__${script.location.parent || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(script);
  }

  const result: Script[] = [];
  for (const group of Object.values(groups)) {
    group.sort((a, b) => b.version.localeCompare(a.version));
    group[0].isLatest = true;
    result.push(...group);
  }

  return result;
}

export function buildTreeFromPaths(paths: { path: string; type: string; size?: number; sha?: string }[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'directory', children: [] };

  for (const item of paths) {
    const parts = item.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!current.children) current.children = [];
      let child = current.children.find((c) => c.name === name);

      if (!child) {
        child = {
          name,
          path: currentPath,
          type: isLast && item.type === 'blob' ? 'file' : 'directory',
          children: isLast && item.type === 'blob' ? undefined : [],
          size: isLast ? item.size : undefined,
          sha: isLast ? item.sha : undefined,
        };
        current.children.push(child);
      }

      current = child;
    }
  }

  // Sort directories first, then files, alphabetically
  const sortTree = (node: TreeNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortTree);
    }
  };
  sortTree(root);

  return root.children || [];
}
