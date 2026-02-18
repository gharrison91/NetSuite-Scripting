/**
 * Analyzes SuiteScript code to extract fields, modules, entry points, and operations.
 */

export interface FieldOperation {
  fieldId: string;
  operation: 'get' | 'set' | 'hide' | 'show' | 'disable' | 'enable' | 'mandatory';
  line: number;
  context: string;
}

export interface ModuleRef {
  module: string;
  alias: string;
}

export interface EntryPoint {
  name: string;
  type: string;
  line: number;
}

export interface ConditionBlock {
  condition: string;
  fields: string[];
  line: number;
}

export interface ScriptAnalysis {
  fields: FieldOperation[];
  modules: ModuleRef[];
  entryPoints: EntryPoint[];
  conditions: ConditionBlock[];
  recordTypes: string[];
  uniqueFieldIds: string[];
  summary: string;
}

const ENTRY_POINT_MAP: Record<string, string> = {
  beforeLoad: 'Before Load',
  beforeSubmit: 'Before Submit',
  afterSubmit: 'After Submit',
  fieldChanged: 'Field Changed',
  pageInit: 'Page Init',
  saveRecord: 'Save Record',
  sublistChanged: 'Sublist Changed',
  lineInit: 'Line Init',
  validateField: 'Validate Field',
  validateLine: 'Validate Line',
  validateInsert: 'Validate Insert',
  validateDelete: 'Validate Delete',
  execute: 'Execute',
  getInputData: 'Get Input Data',
  map: 'Map',
  reduce: 'Reduce',
  summarize: 'Summarize',
  onRequest: 'On Request',
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  delete: 'DELETE',
};

export function analyzeScript(code: string): ScriptAnalysis {
  const lines = code.split('\n');
  const fields: FieldOperation[] = [];
  const modules: ModuleRef[] = [];
  const entryPoints: EntryPoint[] = [];
  const conditions: ConditionBlock[] = [];
  const recordTypes: string[] = [];

  // Extract modules from define([...], function(...))
  const defineMatch = code.match(/define\(\s*\[([\s\S]*?)\]\s*,\s*(?:function\s*)?\(([\s\S]*?)\)/);
  if (defineMatch) {
    const modulePaths = defineMatch[1].match(/'[^']+'/g) || [];
    const aliases = defineMatch[2].split(',').map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < modulePaths.length; i++) {
      const mod = modulePaths[i].replace(/'/g, '');
      const alias = aliases[i] || mod.split('/').pop() || mod;
      modules.push({ module: mod, alias });
    }
  }

  // Line-by-line analysis
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Field getValue/getText
    const getMatches = line.matchAll(/\.(?:getValue|getText|getSublistValue)\(\s*[{]?\s*(?:fieldId\s*:\s*)?['"]([^'"]+)['"]/g);
    for (const m of getMatches) {
      fields.push({
        fieldId: m[1],
        operation: 'get',
        line: lineNum,
        context: line.trim().slice(0, 80),
      });
    }

    // Field setValue
    const setMatches = line.matchAll(/\.(?:setValue|setSublistValue)\(\s*[{]?\s*(?:fieldId\s*:\s*)?['"]([^'"]+)['"]/g);
    for (const m of setMatches) {
      fields.push({
        fieldId: m[1],
        operation: 'set',
        line: lineNum,
        context: line.trim().slice(0, 80),
      });
    }

    // Field display type changes
    const displayMatches = line.matchAll(/\.(?:updateDisplayType|getField)\(\s*[{]?\s*(?:fieldId\s*:\s*)?['"]([^'"]+)['"]/g);
    for (const m of displayMatches) {
      const isHide = /HIDDEN|hide/i.test(line);
      const isDisable = /DISABLED|disable/i.test(line);
      fields.push({
        fieldId: m[1],
        operation: isHide ? 'hide' : isDisable ? 'disable' : 'show',
        line: lineNum,
        context: line.trim().slice(0, 80),
      });
    }

    // isMandatory
    const mandatoryMatch = line.match(/\.(?:isMandatory|setMandatory)\s*.*?['"]([^'"]+)['"]/);
    if (mandatoryMatch) {
      fields.push({
        fieldId: mandatoryMatch[1],
        operation: 'mandatory',
        line: lineNum,
        context: line.trim().slice(0, 80),
      });
    }

    // Entry points
    for (const [funcName, label] of Object.entries(ENTRY_POINT_MAP)) {
      const epRegex = new RegExp(`(?:^\\s*(?:const|let|var)\\s+)?(?:${funcName}|['"]${funcName}['"])\\s*[:=]\\s*(?:function|\\()`);
      if (epRegex.test(line)) {
        entryPoints.push({ name: funcName, type: label, line: lineNum });
      }
      // Also check return { entryPoint: handler }
      const returnEpRegex = new RegExp(`['"]?${funcName}['"]?\\s*:\\s*(\\w+)`);
      if (/return\s*\{/.test(lines.slice(Math.max(0, i - 5), i + 1).join('\n')) && returnEpRegex.test(line)) {
        if (!entryPoints.find((ep) => ep.name === funcName)) {
          entryPoints.push({ name: funcName, type: label, line: lineNum });
        }
      }
    }

    // Conditions affecting fields
    if (/^\s*if\s*\(/.test(line)) {
      const conditionFields: string[] = [];
      const fieldRefs = line.matchAll(/['"]([a-z_][a-z0-9_]*)['"]/gi);
      for (const m of fieldRefs) {
        if (m[1].length > 2 && !['true', 'false', 'null', 'undefined'].includes(m[1])) {
          conditionFields.push(m[1]);
        }
      }
      if (conditionFields.length > 0) {
        conditions.push({
          condition: line.trim().slice(0, 100),
          fields: conditionFields,
          line: lineNum,
        });
      }
    }

    // Record type references
    const recordTypeMatch = line.match(/record\.(?:Type|create|load|delete|submitFields)\s*\(\s*\{?\s*type\s*:\s*(?:record\.Type\.)?['"]?(\w+)/i);
    if (recordTypeMatch) {
      const rt = recordTypeMatch[1];
      if (!recordTypes.includes(rt)) recordTypes.push(rt);
    }
  }

  // Deduplicate field IDs
  const uniqueFieldIds = [...new Set(fields.map((f) => f.fieldId))];

  // Generate summary
  const summary = generateSummary(entryPoints, fields, modules, recordTypes);

  return { fields, modules, entryPoints, conditions, recordTypes, uniqueFieldIds, summary };
}

function generateSummary(
  entryPoints: EntryPoint[],
  fields: FieldOperation[],
  modules: ModuleRef[],
  recordTypes: string[]
): string {
  const parts: string[] = [];

  if (entryPoints.length > 0) {
    parts.push(`Entry points: ${entryPoints.map((ep) => ep.type).join(', ')}`);
  }

  const reads = fields.filter((f) => f.operation === 'get');
  const writes = fields.filter((f) => f.operation === 'set');
  const uiOps = fields.filter((f) => ['hide', 'show', 'disable', 'enable', 'mandatory'].includes(f.operation));

  if (reads.length > 0) {
    parts.push(`Reads ${reads.length} field${reads.length !== 1 ? 's' : ''}`);
  }
  if (writes.length > 0) {
    parts.push(`Writes ${writes.length} field${writes.length !== 1 ? 's' : ''}`);
  }
  if (uiOps.length > 0) {
    parts.push(`${uiOps.length} UI operation${uiOps.length !== 1 ? 's' : ''} (show/hide/disable)`);
  }
  if (recordTypes.length > 0) {
    parts.push(`Records: ${recordTypes.join(', ')}`);
  }
  if (modules.length > 0) {
    parts.push(`${modules.length} module${modules.length !== 1 ? 's' : ''} imported`);
  }

  return parts.join(' | ') || 'No significant operations detected';
}
