'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Wand2,
  Copy,
  Check,
  Loader2,
  FileCode2,
  BookOpen,
  Ruler,
  Eye,
  Code,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SCRIPT_TYPES = [
  { value: 'user-event', label: 'User Event' },
  { value: 'client', label: 'Client Script' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'suitelet', label: 'Suitelet' },
  { value: 'restlet', label: 'RESTlet' },
  { value: 'map-reduce', label: 'Map/Reduce' },
  { value: 'workflow-action', label: 'Workflow Action' },
];

interface ContextFile {
  name: string;
  path: string;
  source: 'reference' | 'standards';
  selected: boolean;
}

// Simple keyword-based syntax highlighting for SuiteScript
function highlightCode(code: string) {
  const lines = code.split('\n');
  return lines.map((line, i) => {
    let highlighted = line
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Comments (// and /** */)
    if (/^\s*\/\//.test(highlighted) || /^\s*\*/.test(highlighted) || /^\s*\/\*/.test(highlighted)) {
      highlighted = `<span class="text-emerald-400">${highlighted}</span>`;
    } else {
      // Strings
      highlighted = highlighted.replace(
        /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g,
        '<span class="text-amber-300">$1</span>'
      );
      // Keywords
      highlighted = highlighted.replace(
        /\b(define|return|const|let|var|function|if|else|try|catch|finally|throw|new|typeof|instanceof|for|while|switch|case|break|default|true|false|null|undefined)\b/g,
        '<span class="text-purple-400">$1</span>'
      );
      // @ annotations in JSDoc
      highlighted = highlighted.replace(
        /(@\w+)/g,
        '<span class="text-blue-400">$1</span>'
      );
      // Numbers
      highlighted = highlighted.replace(
        /\b(\d+)\b/g,
        '<span class="text-orange-300">$1</span>'
      );
      // Function calls
      highlighted = highlighted.replace(
        /\b(\w+)(\s*\()/g,
        '<span class="text-yellow-200">$1</span>$2'
      );
    }

    return (
      <div key={i} className="flex">
        <span className="select-none text-muted-foreground/40 w-10 text-right pr-4 shrink-0">
          {i + 1}
        </span>
        <span dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    );
  });
}

export function ScriptBuilder() {
  const { tree, config } = useRepo();
  const [scriptType, setScriptType] = useState('user-event');
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  // Discover reference and standards files from repo tree
  useEffect(() => {
    const files: ContextFile[] = [];
    const refDir = tree.find((n) => n.name === 'reference' && n.type === 'directory');
    if (refDir?.children) {
      for (const child of refDir.children) {
        if (child.type === 'file' && child.name.endsWith('.md')) {
          files.push({
            name: child.name.replace('.md', '').replace(/-/g, ' '),
            path: child.path,
            source: 'reference',
            selected: child.name === 'internal-ids.md' || child.name === 'permissions.md',
          });
        }
      }
    }
    const stdDir = tree.find((n) => n.name === 'standards' && n.type === 'directory');
    if (stdDir?.children) {
      for (const child of stdDir.children) {
        if (child.type === 'file' && child.name.endsWith('.md')) {
          files.push({
            name: child.name.replace('.md', '').replace(/-/g, ' '),
            path: child.path,
            source: 'standards',
            selected: true,
          });
        }
      }
    }
    setContextFiles(files);
  }, [tree]);

  const toggleContext = useCallback((path: string) => {
    setContextFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, selected: !f.selected } : f))
    );
  }, []);

  const selectedCount = useMemo(
    () => contextFiles.filter((f) => f.selected).length,
    [contextFiles]
  );

  const handleGenerate = async () => {
    if (!prompt.trim() || !config) return;
    setGenerating(true);
    setError(null);
    setGeneratedCode('');

    try {
      // Fetch selected context files in PARALLEL
      const selected = contextFiles.filter((f) => f.selected);
      const fetchPromises = selected.map(async (file) => {
        try {
          const res = await fetch(
            `/api/repo/file?owner=${config.owner}&repo=${config.repo}&branch=${config.branch}&path=${encodeURIComponent(file.path)}`
          );
          if (!res.ok) return null;
          const data = await res.json();
          return { name: file.name, content: data.content as string };
        } catch {
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);
      const contextData = results.filter(
        (r): r is { name: string; content: string } => r !== null
      );

      // Call the AI generate endpoint with a client-side timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            scriptType,
            contextFiles: contextData,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error || `Request failed (${res.status})`
          );
        }

        const data = await res.json();
        // Strip markdown code fences if present
        let code = data.code || '';
        code = code.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '');
        setGeneratedCode(code);
      } catch (fetchErr) {
        clearTimeout(timeout);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error(
            'Request timed out. Try a simpler prompt or fewer context files.'
          );
        }
        throw fetchErr;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const typePrefix =
      scriptType === 'user-event'
        ? 'ue'
        : scriptType === 'map-reduce'
          ? 'mr'
          : scriptType === 'workflow-action'
            ? 'wa'
            : scriptType === 'client'
              ? 'cs'
              : scriptType;
    a.href = url;
    a.download = `${typePrefix}_generated_script.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!config) {
    return (
      <EmptyState
        title="No Repository Loaded"
        description="Connect to a repository to use the Script Builder."
        icon={Wand2}
      />
    );
  }

  const referenceFiles = contextFiles.filter((f) => f.source === 'reference');
  const standardsFiles = contextFiles.filter((f) => f.source === 'standards');

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Left Panel — Configuration */}
      <div className="w-80 shrink-0 border rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Script Builder</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            AI-powered SuiteScript generator
          </p>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Script Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Script Type
            </label>
            <Select value={scriptType} onValueChange={setScriptType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCRIPT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Context Files */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Include Context
              </label>
              {selectedCount > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {selectedCount}
                </Badge>
              )}
            </div>

            {referenceFiles.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BookOpen className="h-3 w-3" />
                  <span>Reference</span>
                </div>
                {referenceFiles.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => toggleContext(f.path)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded text-xs transition-colors',
                      f.selected
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-3 w-3 rounded border flex items-center justify-center shrink-0',
                          f.selected
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/30'
                        )}
                      >
                        {f.selected && (
                          <Check className="h-2 w-2 text-primary-foreground" />
                        )}
                      </span>
                      {f.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {standardsFiles.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Ruler className="h-3 w-3" />
                  <span>Standards</span>
                </div>
                {standardsFiles.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => toggleContext(f.path)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded text-xs transition-colors',
                      f.selected
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-3 w-3 rounded border flex items-center justify-center shrink-0',
                          f.selected
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/30'
                        )}
                      >
                        {f.selected && (
                          <Check className="h-2 w-2 text-primary-foreground" />
                        )}
                      </span>
                      {f.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Describe Your Script
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Create a User Event script that validates the email field on Sales Orders before submit, and sets a custom checkbox field if the customer is a preferred vendor..."
              className="w-full h-32 px-3 py-2 rounded-md border bg-transparent text-sm resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Generate Button */}
        <div className="p-4 border-t">
          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Script
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Right Panel — Output */}
      <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Generated Script</span>
            {generatedCode && (
              <Badge variant="outline" className="text-xs">
                {SCRIPT_TYPES.find((t) => t.value === scriptType)?.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Preview / Code toggle */}
            {generatedCode && (
              <>
                <div className="flex items-center border rounded-md overflow-hidden mr-2">
                  <button
                    onClick={() => setViewMode('preview')}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 text-xs transition-colors',
                      viewMode === 'preview'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                  <button
                    onClick={() => setViewMode('code')}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 text-xs transition-colors',
                      viewMode === 'code'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Code className="h-3 w-3" />
                    Raw
                  </button>
                </div>
                <Button variant="ghost" size="sm" onClick={handleDownload}>
                  <Download className="h-3 w-3 mr-1" />
                  .js
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {generating ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <div>
                  <p className="text-sm font-medium">Generating your script...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Using {selectedCount} context file
                    {selectedCount !== 1 ? 's' : ''} for reference
                  </p>
                </div>
              </div>
            </div>
          ) : generatedCode ? (
            viewMode === 'preview' ? (
              /* Syntax-highlighted preview with line numbers */
              <div className="p-4 text-sm font-mono leading-relaxed overflow-x-auto bg-[#1a1b26]">
                {highlightCode(generatedCode)}
              </div>
            ) : (
              /* Raw code view */
              <pre className="p-4 text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre bg-muted/30">
                <code>{generatedCode}</code>
              </pre>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <Wand2 className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Describe what you need and click Generate
                </p>
                <p className="text-xs text-muted-foreground/60">
                  The AI will use your project&apos;s reference docs and
                  standards as context
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
