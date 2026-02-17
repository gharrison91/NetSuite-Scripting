'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
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
import { Wand2, Copy, Check, Loader2, FileCode2, BookOpen, Ruler } from 'lucide-react';
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

export function ScriptBuilder() {
  const { tree, config } = useRepo();
  const { fetchFile } = useFileContent();
  const [scriptType, setScriptType] = useState('user-event');
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);

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
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setGeneratedCode('');

    try {
      // Fetch selected context files
      const selected = contextFiles.filter((f) => f.selected);
      const contextData: { name: string; content: string }[] = [];

      for (const file of selected) {
        const content = await fetchFile(file.path);
        if (content) {
          contextData.push({ name: file.name, content });
        }
      }

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          scriptType,
          contextFiles: contextData,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setGeneratedCode(data.code || '');
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
      <div className="w-80 shrink-0 border rounded-lg overflow-y-auto flex flex-col">
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
                        {f.selected && <Check className="h-2 w-2 text-primary-foreground" />}
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
                        {f.selected && <Check className="h-2 w-2 text-primary-foreground" />}
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
            <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
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
          {generatedCode && (
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
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {generating ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <div>
                  <p className="text-sm font-medium">Generating your script...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Using {selectedCount} context file{selectedCount !== 1 ? 's' : ''} for reference
                  </p>
                </div>
              </div>
            </div>
          ) : generatedCode ? (
            <pre className="p-4 text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre">
              <code>{generatedCode}</code>
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <Wand2 className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Describe what you need and click Generate
                </p>
                <p className="text-xs text-muted-foreground/60">
                  The AI will use your project&apos;s reference docs and standards as context
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
