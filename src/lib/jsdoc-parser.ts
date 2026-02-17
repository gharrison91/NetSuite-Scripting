import { ParsedJsDoc } from '@/types';

export function parseJsDocHeader(content: string): ParsedJsDoc {
  const result: ParsedJsDoc = {};

  // Extract the first block comment (/** ... */)
  const blockMatch = content.match(/\/\*\*[\s\S]*?\*\//);
  if (!blockMatch) return result;

  const block = blockMatch[0];
  const lines = block.split('\n');

  for (const line of lines) {
    const trimmed = line.replace(/^\s*\*\s?/, '').trim();

    if (trimmed.startsWith('@NApiVersion')) {
      result.apiVersion = extractTagValue(trimmed, '@NApiVersion');
    } else if (trimmed.startsWith('@NScriptType')) {
      result.scriptType = extractTagValue(trimmed, '@NScriptType');
    } else if (trimmed.startsWith('@description')) {
      result.description = extractTagValue(trimmed, '@description');
    } else if (trimmed.startsWith('@version')) {
      result.version = extractTagValue(trimmed, '@version');
    } else if (trimmed.startsWith('@lastModified')) {
      result.lastModified = extractTagValue(trimmed, '@lastModified');
    } else if (trimmed.startsWith('@dependencies')) {
      result.dependencies = extractCommaSeparated(trimmed, '@dependencies');
    } else if (trimmed.startsWith('@dashboards')) {
      result.dashboards = extractCommaSeparated(trimmed, '@dashboards');
    } else if (trimmed.startsWith('@modules')) {
      result.modules = extractCommaSeparated(trimmed, '@modules');
    }
  }

  return result;
}

function extractTagValue(line: string, tag: string): string {
  return line.substring(tag.length).trim().replace(/^['"]|['"]$/g, '');
}

function extractCommaSeparated(line: string, tag: string): string[] {
  const value = extractTagValue(line, tag);
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
