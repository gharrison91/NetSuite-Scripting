import { ParsedTable, Module, GraphEdge, FieldReference } from '@/types';

const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;

function isHtmlComment(cell: string): boolean {
  const trimmed = cell.trim();
  return trimmed.startsWith('<!--') && trimmed.endsWith('-->');
}

function isTemplateRow(cells: string[]): boolean {
  return cells.every((cell) => isHtmlComment(cell) || cell.trim() === '');
}

function cleanCell(cell: string): string {
  return cell.replace(HTML_COMMENT_REGEX, '').trim();
}

export function extractTables(markdown: string): ParsedTable[] {
  const lines = markdown.split('\n');
  const tables: ParsedTable[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      // Found a potential table
      const headerLine = line;
      const headerCells = headerLine
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      // Check for alignment row
      if (i + 1 < lines.length) {
        const alignLine = lines[i + 1].trim();
        if (alignLine.match(/^\|[\s:|-]+\|$/)) {
          // Valid table
          const rows: string[][] = [];
          let j = i + 2;
          while (j < lines.length) {
            const rowLine = lines[j].trim();
            if (!rowLine.startsWith('|') || !rowLine.endsWith('|')) break;
            const cells = rowLine
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim());
            if (!isTemplateRow(cells)) {
              rows.push(cells.map(cleanCell));
            }
            j++;
          }
          tables.push({ headers: headerCells, rows });
          i = j;
          continue;
        }
      }
    }
    i++;
  }

  return tables;
}

export function parseModuleCatalog(markdown: string): Partial<Module>[] {
  const tables = extractTables(markdown);
  const modules: Partial<Module>[] = [];

  for (const table of tables) {
    const nameIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('module') || h.toLowerCase().includes('name')
    );
    const purposeIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('purpose') || h.toLowerCase().includes('description')
    );
    const versionIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('version')
    );
    const statusIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('status')
    );
    const usedByIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('used by') || h.toLowerCase().includes('dashboards')
    );

    if (nameIdx === -1) continue;

    for (const row of table.rows) {
      const name = row[nameIdx] || '';
      if (!name) continue;

      modules.push({
        displayName: name,
        name: name.toLowerCase().replace(/\s+/g, '-'),
        purpose: purposeIdx >= 0 ? row[purposeIdx] || '' : '',
        currentVersion: versionIdx >= 0 ? row[versionIdx] || 'v001' : 'v001',
        status: statusIdx >= 0 ? (row[statusIdx] as Module['status']) || 'Active' : 'Active',
        usedByDashboards: usedByIdx >= 0 ? (row[usedByIdx] || '').split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
    }
  }

  return modules;
}

export function parseDependencies(markdown: string): GraphEdge[] {
  const tables = extractTables(markdown);
  const edges: GraphEdge[] = [];

  for (const table of tables) {
    const sourceIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('source') || h.toLowerCase().includes('from') || h.toLowerCase().includes('script')
    );
    const targetIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('target') || h.toLowerCase().includes('to') || h.toLowerCase().includes('depends')
    );
    const relIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('relationship') || h.toLowerCase().includes('type')
    );
    const detailIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('detail') || h.toLowerCase().includes('note')
    );

    if (sourceIdx === -1 || targetIdx === -1) continue;

    for (const row of table.rows) {
      const source = row[sourceIdx] || '';
      const target = row[targetIdx] || '';
      if (!source || !target) continue;

      const relStr = relIdx >= 0 ? (row[relIdx] || '').toLowerCase() : 'depends_on';
      let relationship: GraphEdge['relationship'] = 'depends_on';
      if (relStr.includes('call')) relationship = 'calls';
      else if (relStr.includes('trigger')) relationship = 'triggers';
      else if (relStr.includes('share')) relationship = 'shares_data';

      edges.push({
        source,
        target,
        relationship,
        details: detailIdx >= 0 ? row[detailIdx] : undefined,
      });
    }
  }

  return edges;
}

export function parseFieldUsage(markdown: string): FieldReference[] {
  const tables = extractTables(markdown);
  const fields: FieldReference[] = [];

  for (const table of tables) {
    const idIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('internal') || h.toLowerCase().includes('id') || h.toLowerCase().includes('field')
    );
    const labelIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('label') || h.toLowerCase().includes('name')
    );
    const recordIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('record')
    );
    const scriptsIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('script')
    );
    const rwIdx = table.headers.findIndex((h) =>
      h.toLowerCase().includes('r/w') || h.toLowerCase().includes('read') || h.toLowerCase().includes('access')
    );

    if (idIdx === -1) continue;

    for (const row of table.rows) {
      const id = row[idIdx] || '';
      if (!id) continue;

      fields.push({
        internalId: id,
        label: labelIdx >= 0 ? row[labelIdx] || '' : '',
        record: recordIdx >= 0 ? row[recordIdx] || '' : '',
        usedByScripts: scriptsIdx >= 0 ? (row[scriptsIdx] || '').split(',').map((s) => s.trim()).filter(Boolean) : [],
        usedByDashboards: [],
        usedByModules: [],
        readWrite: rwIdx >= 0 ? (row[rwIdx] as FieldReference['readWrite']) || 'Read' : 'Read',
      });
    }
  }

  return fields;
}
