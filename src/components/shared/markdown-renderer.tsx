'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ParsedTableView } from './parsed-table';
import { extractTables } from '@/lib/markdown-parser';

interface MarkdownRendererProps {
  content: string;
  enableTableParsing?: boolean;
}

export function MarkdownRenderer({ content, enableTableParsing = false }: MarkdownRendererProps) {
  let parsedTables: ReturnType<typeof extractTables> = [];
  try {
    parsedTables = enableTableParsing ? extractTables(content) : [];
  } catch (e) {
    console.error('[MarkdownRenderer] extractTables failed:', e);
  }
  let tableIndex = 0;

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => {
            if (enableTableParsing && tableIndex < parsedTables.length) {
              const table = parsedTables[tableIndex++];
              return <ParsedTableView headers={table.headers} rows={table.rows} searchable />;
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            );
          },
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left bg-muted font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">{children}</td>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`block bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono ${className || ''}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="bg-muted rounded-lg overflow-x-auto">{children}</pre>,
          h1: ({ children }) => <h1 className="text-xl font-bold mt-6 mb-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold mt-5 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2">{children}</h3>,
          a: ({ href, children }) => (
            <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      />
    </div>
  );
}
