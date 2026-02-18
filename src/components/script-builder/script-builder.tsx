'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  BookOpen,
  Ruler,
  Eye,
  Download,
  Send,
  Trash2,
  User,
  Bot,
  ChevronRight,
  ChevronLeft,
  Plus,
  MessageSquare,
  StopCircle,
  Monitor,
  FileText,
  Activity,
  ArrowRight,
  Hash,
  Boxes,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { analyzeScript, type ScriptAnalysis, type FieldOperation } from '@/lib/script-analyzer';
import { RelationshipView } from './relationship-view';

/* ------------------------------------------------------------------ */
/*  Constants & types                                                  */
/* ------------------------------------------------------------------ */

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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  code: string | null;
  htmlPreview: string | null;
}

interface ChatSession {
  id: string;
  name: string;
  scriptType: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/*  LocalStorage persistence                                           */
/* ------------------------------------------------------------------ */

const SESSIONS_KEY = 'netsuite-chat-sessions';
const ACTIVE_KEY = 'netsuite-active-session';

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.warn('Failed to save sessions to localStorage:', err);
  }
}

function loadActiveId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_KEY);
}

function saveActiveId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseAiResponse(raw: string): { text: string; code: string | null; htmlPreview: string | null } {
  let cleaned = raw.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '');

  let htmlPreview: string | null = null;
  const htmlIdx = cleaned.indexOf('---HTML_PREVIEW---');
  if (htmlIdx !== -1) {
    htmlPreview = cleaned.slice(htmlIdx + '---HTML_PREVIEW---'.length).trim();
    htmlPreview = htmlPreview.replace(/---END_PREVIEW---\s*$/i, '').trim();
    cleaned = cleaned.slice(0, htmlIdx).trim();
  }

  const codeIdx = cleaned.indexOf('---CODE---');
  if (codeIdx !== -1) {
    const text = cleaned.slice(0, codeIdx).trim();
    let code = cleaned.slice(codeIdx + '---CODE---'.length).trim();
    code = code.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '');
    return { text, code, htmlPreview };
  }

  const looksLikeCode =
    cleaned.includes('/**') ||
    cleaned.includes('define([') ||
    cleaned.includes('@NApiVersion') ||
    /^\/\*\*/m.test(cleaned);

  if (looksLikeCode) {
    return { text: '', code: cleaned, htmlPreview };
  }

  if (!htmlPreview && (/<html[\s>]/i.test(cleaned) || /<!DOCTYPE\s+html/i.test(cleaned))) {
    return { text: '', code: cleaned, htmlPreview: cleaned };
  }

  return { text: cleaned, code: null, htmlPreview };
}

function parseSSEDelta(chunk: string): string {
  let text = '';
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6).trim();
    if (jsonStr === '[DONE]') continue;
    try {
      const event = JSON.parse(jsonStr);
      if (event.type === 'content_block_delta' && event.delta?.text) {
        text += event.delta.text;
      }
    } catch {
      // Skip malformed JSON
    }
  }
  return text;
}

function highlightCode(code: string) {
  const lines = code.split('\n');
  return lines.map((line, i) => {
    let h = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (/^\s*\/\//.test(h) || /^\s*\*/.test(h) || /^\s*\/\*/.test(h)) {
      h = `<span class="text-emerald-400">${h}</span>`;
    } else {
      h = h.replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="text-amber-300">$1</span>');
      h = h.replace(
        /\b(define|return|const|let|var|function|if|else|try|catch|finally|throw|new|typeof|instanceof|for|while|switch|case|break|default|true|false|null|undefined)\b/g,
        '<span class="text-purple-400">$1</span>'
      );
      h = h.replace(/(@\w+)/g, '<span class="text-blue-400">$1</span>');
      h = h.replace(/\b(\d+)\b/g, '<span class="text-orange-300">$1</span>');
      h = h.replace(/\b(\w+)(\s*\()/g, '<span class="text-yellow-200">$1</span>$2');
    }

    return (
      <div key={i} className="flex">
        <span className="select-none text-muted-foreground/40 w-10 text-right pr-4 shrink-0">{i + 1}</span>
        <span dangerouslySetInnerHTML={{ __html: h }} />
      </div>
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Code block component                                               */
/* ------------------------------------------------------------------ */

function CodeBlock({ message, scriptType }: { message: ChatMessage; scriptType: string }) {
  const [view, setView] = useState<'code' | 'raw' | 'ui' | 'analysis'>(() =>
    message.htmlPreview ? 'ui' : 'code'
  );
  const [copied, setCopied] = useState(false);
  const analysis = useMemo(() =>
    message.code ? analyzeScript(message.code) : null,
    [message.code]
  );

  const handleCopy = async () => {
    if (message.code) {
      await navigator.clipboard.writeText(message.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!message.code) return;
    const blob = new Blob([message.code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const prefix =
      scriptType === 'user-event' ? 'ue' :
      scriptType === 'map-reduce' ? 'mr' :
      scriptType === 'workflow-action' ? 'wa' :
      scriptType === 'client' ? 'cs' : scriptType;
    a.href = url;
    a.download = `${prefix}_script.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!message.code) return null;

  return (
    <div className="border rounded-lg overflow-hidden mt-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {SCRIPT_TYPES.find((t) => t.value === scriptType)?.label}
          </Badge>
          <div className="flex items-center border rounded overflow-hidden">
            {message.htmlPreview && (
              <button
                onClick={() => setView('ui')}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors',
                  view === 'ui' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Monitor className="h-2.5 w-2.5" />
                UI Preview
              </button>
            )}
            <button
              onClick={() => setView('code')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors',
                view === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Eye className="h-2.5 w-2.5" />
              Code
            </button>
            <button
              onClick={() => setView('raw')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors',
                view === 'raw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <FileText className="h-2.5 w-2.5" />
              Raw
            </button>
            <button
              onClick={() => setView('analysis')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors',
                view === 'analysis' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Activity className="h-2.5 w-2.5" />
              Analysis
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={handleDownload}>
            <Download className="h-2.5 w-2.5 mr-1" />.js
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={handleCopy}>
            {copied ? <><Check className="h-2.5 w-2.5 mr-1" />Copied</> : <><Copy className="h-2.5 w-2.5 mr-1" />Copy</>}
          </Button>
        </div>
      </div>

      {view === 'ui' && message.htmlPreview ? (
        <div className="bg-white">
          <iframe
            srcDoc={message.htmlPreview}
            sandbox="allow-scripts"
            className="w-full border-0"
            style={{ minHeight: 300 }}
            title="UI Preview"
            onLoad={(e) => {
              const iframe = e.target as HTMLIFrameElement;
              try {
                const h = iframe.contentDocument?.body?.scrollHeight;
                if (h) iframe.style.height = `${Math.min(h + 20, 600)}px`;
              } catch { /* cross-origin */ }
            }}
          />
        </div>
      ) : view === 'analysis' && analysis ? (
        <ScriptAnalysisView analysis={analysis} />
      ) : view === 'code' ? (
        <div className="p-3 text-xs font-mono leading-relaxed overflow-x-auto bg-[#1a1b26] max-h-[500px] overflow-y-auto">
          {highlightCode(message.code)}
        </div>
      ) : (
        <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre bg-muted/30 max-h-[500px] overflow-y-auto">
          <code>{message.code}</code>
        </pre>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Script Analysis View                                               */
/* ------------------------------------------------------------------ */

function ScriptAnalysisView({ analysis }: { analysis: ScriptAnalysis }) {
  const [fieldSearch, setFieldSearch] = useState('');

  const OP_COLORS: Record<string, string> = {
    get: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    set: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    hide: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    show: 'bg-green-500/15 text-green-400 border-green-500/30',
    disable: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    enable: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    mandatory: 'bg-red-500/15 text-red-400 border-red-500/30',
  };

  const OP_LABELS: Record<string, string> = {
    get: 'READ',
    set: 'WRITE',
    hide: 'HIDE',
    show: 'SHOW',
    disable: 'DISABLE',
    enable: 'ENABLE',
    mandatory: 'REQUIRED',
  };

  const filteredFields = fieldSearch
    ? analysis.fields.filter((f) => f.fieldId.toLowerCase().includes(fieldSearch.toLowerCase()))
    : analysis.fields;

  // Group field operations by field ID
  const fieldGroups = new Map<string, FieldOperation[]>();
  for (const f of filteredFields) {
    if (!fieldGroups.has(f.fieldId)) fieldGroups.set(f.fieldId, []);
    fieldGroups.get(f.fieldId)!.push(f);
  }

  return (
    <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto text-sm">
      {/* Summary bar */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-xs text-muted-foreground">{analysis.summary}</p>
      </div>

      {/* Entry Points */}
      {analysis.entryPoints.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Entry Points
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.entryPoints.map((ep, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs"
              >
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium">{ep.type}</span>
                <span className="text-[10px] text-muted-foreground">L{ep.line}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modules */}
      {analysis.modules.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Modules
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.modules.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs"
              >
                <Boxes className="h-3 w-3" />
                <span className="font-mono">{m.module}</span>
                <span className="text-[10px] text-muted-foreground">as {m.alias}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field Operations */}
      {analysis.fields.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Field Operations ({analysis.uniqueFieldIds.length} fields)
            </h4>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter fields..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="pl-7 pr-2 py-1 text-[11px] rounded border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-36"
              />
            </div>
          </div>

          <div className="space-y-2">
            {[...fieldGroups.entries()].map(([fieldId, ops]) => (
              <div key={fieldId} className="rounded-lg border bg-card/50 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-xs font-medium text-foreground">{fieldId}</span>
                  <div className="flex gap-1 ml-auto">
                    {[...new Set(ops.map((o) => o.operation))].map((op) => (
                      <span
                        key={op}
                        className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded border font-semibold',
                          OP_COLORS[op] || 'bg-muted text-muted-foreground'
                        )}
                      >
                        {OP_LABELS[op] || op.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-0.5">
                  {ops.map((op, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="w-8 text-right shrink-0">L{op.line}</span>
                      <span className="font-mono truncate">{op.context}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conditions */}
      {analysis.conditions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Conditional Logic
          </h4>
          <div className="space-y-1.5">
            {analysis.conditions.map((c, i) => (
              <div key={i} className="rounded border bg-amber-500/5 border-amber-500/20 p-2">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground shrink-0">L{c.line}</span>
                  <code className="font-mono text-amber-400 truncate">{c.condition}</code>
                </div>
                {c.fields.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {c.fields.map((f, j) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-mono">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record types */}
      {analysis.recordTypes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Record Types
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.recordTypes.map((rt, i) => (
              <span key={i} className="text-xs px-2.5 py-1.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono">
                {rt}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.fields.length === 0 && analysis.entryPoints.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-xs">
          No significant script operations detected. The script may use patterns
          not yet recognized by the analyzer.
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-session generation tracking                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ScriptBuilder() {
  const { tree, config } = useRepo();

  /* Session state */
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  /* Config state */
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* Per-session generation tracking */
  const [generatingSet, setGeneratingSet] = useState<Set<string>>(new Set());
  const [streamingTexts, setStreamingTexts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [topView, setTopView] = useState<'chat' | 'code' | 'relationship'>('chat');

  const abortControllers = useRef<Record<string, AbortController>>({});
  const cachedContext = useRef<{ name: string; content: string }[] | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Derived: active session & messages */
  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const messages = activeSession?.messages ?? [];
  const scriptType = activeSession?.scriptType ?? 'user-event';
  const isActiveGenerating = activeId ? generatingSet.has(activeId) : false;
  const activeStreamingText = activeId ? streamingTexts[activeId] || '' : '';

  /* Latest code from this session (for persistent code/relationship views) */
  const latestCode = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].code) return messages[i].code;
    }
    return null;
  }, [messages]);

  const latestAnalysis = useMemo(() => {
    return latestCode ? analyzeScript(latestCode) : null;
  }, [latestCode]);

  /* ---- Persistence ---- */

  useEffect(() => {
    const loaded = loadSessions();
    const savedId = loadActiveId();
    if (loaded.length > 0) {
      setSessions(loaded);
      if (savedId && loaded.find((s) => s.id === savedId)) {
        setActiveId(savedId);
      } else {
        setActiveId(loaded[loaded.length - 1].id);
      }
    }
    setInitialized(true);
  }, []);

  /* ---- Pick up editScript from sessionStorage (Edit in Builder flow) ---- */
  const loadEditScript = useCallback(() => {
    try {
      const raw = sessionStorage.getItem('scriptBuilder:editScript');
      if (!raw) return;
      sessionStorage.removeItem('scriptBuilder:editScript');
      const editData = JSON.parse(raw) as {
        code: string;
        filename: string;
        scriptType: string;
        path: string;
      };

      // Create a new session with the existing script pre-loaded
      const editSession: ChatSession = {
        id: crypto.randomUUID(),
        name: `Edit: ${editData.filename}`,
        scriptType: editData.scriptType || 'user-event',
        messages: [
          {
            id: crypto.randomUUID(),
            role: 'user',
            text: `I want to edit this existing script: **${editData.filename}** (from \`${editData.path}\`).\n\nHere's the current code — what changes would you like to make?`,
            code: null,
            htmlPreview: null,
          },
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `I've loaded **${editData.filename}**. Here's the current code. Tell me what changes you'd like to make — I can refactor, add features, fix bugs, or modify field logic.`,
            code: editData.code,
            htmlPreview: null,
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setSessions((prev) => [...prev, editSession]);
      setActiveId(editSession.id);
      setError(null);
      setInput('');
      setTopView('chat');
    } catch (err) {
      console.warn('Failed to load editScript from sessionStorage:', err);
    }
  }, []);

  // Check on initial mount
  useEffect(() => {
    if (initialized) loadEditScript();
  }, [initialized, loadEditScript]);

  // Listen for custom event (fired when user clicks "Edit in Builder" while ScriptBuilder is already mounted)
  useEffect(() => {
    const handler = () => loadEditScript();
    window.addEventListener('scriptBuilder:editScript', handler);
    return () => window.removeEventListener('scriptBuilder:editScript', handler);
  }, [loadEditScript]);

  useEffect(() => {
    if (initialized && sessions.length === 0) {
      const s: ChatSession = {
        id: crypto.randomUUID(),
        name: 'New Chat',
        scriptType: 'user-event',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setSessions([s]);
      setActiveId(s.id);
    }
  }, [initialized, sessions.length]);

  useEffect(() => {
    if (initialized) saveSessions(sessions);
  }, [sessions, initialized]);

  useEffect(() => {
    if (initialized) saveActiveId(activeId);
  }, [activeId, initialized]);

  /* Auto-scroll (only for active session) */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isActiveGenerating, activeStreamingText]);

  /* Discover context files */
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
    setContextFiles((prev) => prev.map((f) => (f.path === path ? { ...f, selected: !f.selected } : f)));
    cachedContext.current = null;
  }, []);

  const selectedCount = useMemo(() => contextFiles.filter((f) => f.selected).length, [contextFiles]);

  /* ---- Session management ---- */

  const createSession = useCallback(() => {
    const s: ChatSession = {
      id: crypto.randomUUID(),
      name: 'New Chat',
      scriptType: 'user-event',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
    setError(null);
    setInput('');
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveId(id);
    setError(null);
    setInput('');
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      // Abort if generating
      if (abortControllers.current[id]) {
        abortControllers.current[id].abort();
        delete abortControllers.current[id];
      }
      setGeneratingSet((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeId === id) {
          const newActive = next.length > 0 ? next[next.length - 1].id : null;
          setActiveId(newActive);
        }
        return next;
      });
    },
    [activeId]
  );

  const updateScriptType = useCallback(
    (type: string) => {
      if (!activeId) return;
      setSessions((prev) =>
        prev.map((s) => (s.id === activeId ? { ...s, scriptType: type, updatedAt: Date.now() } : s))
      );
    },
    [activeId]
  );

  const addMessageToSession = useCallback(
    (sessionId: string, msg: ChatMessage) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const isFirst = s.messages.length === 0 && msg.role === 'user';
          return {
            ...s,
            messages: [...s.messages, msg],
            name: isFirst ? msg.text.slice(0, 50) + (msg.text.length > 50 ? '...' : '') : s.name,
            updatedAt: Date.now(),
          };
        })
      );
    },
    []
  );

  /* ---- Stop generation for a session ---- */
  const handleStop = useCallback((sessionId?: string) => {
    const id = sessionId || activeId;
    if (!id) return;
    if (abortControllers.current[id]) {
      abortControllers.current[id].abort();
    }
  }, [activeId]);

  /* ---- Send message (streaming, per-session) ---- */
  const handleSend = async () => {
    if (!input.trim() || !config || !activeId) return;
    if (isActiveGenerating) return; // Don't double-send in same session

    const sessionId = activeId;
    const currentMessages = [...messages];
    const currentScriptType = scriptType;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input.trim(),
      code: null,
      htmlPreview: null,
    };

    addMessageToSession(sessionId, userMsg);
    setInput('');
    setGeneratingSet((prev) => new Set(prev).add(sessionId));
    setStreamingTexts((prev) => ({ ...prev, [sessionId]: '' }));
    setError(null);

    try {
      // Fetch context files if not cached
      if (!cachedContext.current) {
        const selected = contextFiles.filter((f) => f.selected);
        const results = await Promise.all(
          selected.map(async (file) => {
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
          })
        );
        cachedContext.current = results.filter((r): r is { name: string; content: string } => r !== null);
      }

      const apiMessages = [...currentMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.role === 'user' ? m.text : [m.text, m.code].filter(Boolean).join('\n\n'),
      }));

      const abortController = new AbortController();
      abortControllers.current[sessionId] = abortController;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          scriptType: currentScriptType,
          contextFiles: cachedContext.current,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }

      // Read SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const delta = parseSSEDelta(chunk);
        if (delta) {
          fullText += delta;
          setStreamingTexts((prev) => ({ ...prev, [sessionId]: fullText }));
        }
      }

      // Parse completed response
      const parsed = parseAiResponse(fullText);
      addMessageToSession(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: parsed.text,
        code: parsed.code,
        htmlPreview: parsed.htmlPreview,
      });

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled — save partial response
        const partial = streamingTexts[sessionId] || '';
        if (partial) {
          const parsed = parseAiResponse(partial);
          addMessageToSession(sessionId, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: parsed.text || '(generation stopped)',
            code: parsed.code,
            htmlPreview: parsed.htmlPreview,
          });
        }
      } else {
        if (sessionId === activeId) {
          setError(err instanceof Error ? err.message : 'Failed to generate');
        }
      }
    } finally {
      delete abortControllers.current[sessionId];
      setGeneratingSet((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
      setStreamingTexts((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      if (sessionId === activeId) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ---- Guard ---- */
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
  const totalGenerating = generatingSet.size;

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* ---- Sidebar ---- */}
      <div
        className={cn(
          'border rounded-lg overflow-hidden flex flex-col transition-all duration-200 shrink-0',
          sidebarOpen ? 'w-64' : 'w-10'
        )}
      >
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="p-2 border-b hover:bg-muted transition-colors flex items-center justify-center"
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {sidebarOpen && (
          <>
            <div className="p-3 border-b">
              <div className="flex items-center gap-2">
                <Wand2 className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-xs font-semibold">Script Builder</h2>
                {totalGenerating > 0 && (
                  <Badge variant="default" className="text-[9px] px-1 py-0 h-4 ml-auto animate-pulse">
                    {totalGenerating} active
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              {/* Script Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Script Type
                </label>
                <Select value={scriptType} onValueChange={updateScriptType}>
                  <SelectTrigger className="w-full h-8 text-xs">
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Context
                  </label>
                  {selectedCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      {selectedCount}
                    </Badge>
                  )}
                </div>

                {referenceFiles.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <BookOpen className="h-2.5 w-2.5" />
                      <span>Reference</span>
                    </div>
                    {referenceFiles.map((f) => (
                      <button
                        key={f.path}
                        onClick={() => toggleContext(f.path)}
                        className={cn(
                          'w-full text-left px-1.5 py-1 rounded text-[11px] transition-colors',
                          f.selected ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'h-2.5 w-2.5 rounded border flex items-center justify-center shrink-0',
                              f.selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                            )}
                          >
                            {f.selected && <Check className="h-1.5 w-1.5 text-primary-foreground" />}
                          </span>
                          {f.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {standardsFiles.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Ruler className="h-2.5 w-2.5" />
                      <span>Standards</span>
                    </div>
                    {standardsFiles.map((f) => (
                      <button
                        key={f.path}
                        onClick={() => toggleContext(f.path)}
                        className={cn(
                          'w-full text-left px-1.5 py-1 rounded text-[11px] transition-colors',
                          f.selected ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'h-2.5 w-2.5 rounded border flex items-center justify-center shrink-0',
                              f.selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                            )}
                          >
                            {f.selected && <Check className="h-1.5 w-1.5 text-primary-foreground" />}
                          </span>
                          {f.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sessions */}
              <div className="space-y-1.5 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Sessions
                  </label>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                    {sessions.length}
                  </Badge>
                </div>

                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {sessions
                    .slice()
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map((s) => (
                      <div
                        key={s.id}
                        onClick={() => switchSession(s.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-1.5 py-1.5 rounded text-[11px] cursor-pointer group transition-colors',
                          s.id === activeId
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {generatingSet.has(s.id) ? (
                          <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin text-primary" />
                        ) : (
                          <MessageSquare className="h-2.5 w-2.5 shrink-0" />
                        )}
                        <span className="truncate flex-1">{s.name}</span>
                        <span className="text-[9px] text-muted-foreground/50 shrink-0">
                          {s.messages.length}
                        </span>
                        {sessions.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(s.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        )}
                      </div>
                    ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-[11px] h-7"
                  onClick={createSession}
                >
                  <Plus className="h-2.5 w-2.5 mr-1" />
                  New Chat
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---- Chat area ---- */}
      <div className="flex-1 flex flex-col ml-4 border rounded-lg overflow-hidden">
        {/* Persistent view buttons */}
        <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 shrink-0">
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              onClick={() => setTopView('chat')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                topView === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </button>
            <button
              onClick={() => setTopView('code')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                topView === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Code View
            </button>
            <button
              onClick={() => setTopView('relationship')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                topView === 'relationship' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Activity className="h-3.5 w-3.5" />
              Relationship
            </button>
          </div>
          {latestCode && topView !== 'chat' && (
            <span className="text-[10px] text-muted-foreground ml-2">
              Showing latest generated code
            </span>
          )}
        </div>

        {/* View content */}
        {topView === 'code' ? (
          <div className="flex-1 overflow-auto">
            {latestCode ? (
              <div className="p-3 text-xs font-mono leading-relaxed overflow-x-auto bg-[#1a1b26] min-h-full">
                {highlightCode(latestCode)}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <div className="text-center space-y-2">
                  <Eye className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <p>No code generated yet.</p>
                  <p className="text-xs">Switch to Chat, describe the script you need, and the code will appear here.</p>
                </div>
              </div>
            )}
          </div>
        ) : topView === 'relationship' ? (
          <div className="flex-1 relative">
            <RelationshipView analysis={latestAnalysis} />
          </div>
        ) : (
        /* Messages (chat view) */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isActiveGenerating ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3 max-w-md">
                <Wand2 className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <h3 className="text-sm font-medium">SuiteScript Chat</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Describe the script you need. You can iterate with follow-up messages
                  just like a normal conversation. For Suitelets and UI scripts, a visual
                  preview will be generated automatically.
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  Tip: When code is generated, use the <strong>Code</strong> / <strong>Raw</strong> / <strong>UI Preview</strong> tabs
                  above the code block to switch views.
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                  {[
                    'Create a Suitelet with a customer lookup form',
                    'Build a User Event script for Sales Order validation',
                    'Generate a Map/Reduce for invoice processing',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-[11px] px-2.5 py-1.5 rounded-full border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}

                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground px-3 py-2'
                        : 'bg-muted/40 px-3 py-2 flex-1'
                    )}
                  >
                    {msg.text && (
                      <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', msg.role === 'assistant' && msg.code && 'mb-2')}>
                        {msg.text}
                      </p>
                    )}
                    {msg.code && msg.role === 'assistant' && (
                      <CodeBlock message={msg} scriptType={scriptType} />
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mt-0.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming response */}
              {isActiveGenerating && (
                <div className="flex gap-3 justify-start">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-muted/40 rounded-lg px-3 py-2 flex-1">
                    {activeStreamingText ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{activeStreamingText}</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">Generating...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="mx-auto max-w-md p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center">
              {error}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
        )}

        {/* Input bar */}
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you need... (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] max-h-[120px]"
              style={{ height: 'auto', overflow: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
              }}
            />
            {isActiveGenerating ? (
              <Button
                onClick={() => handleStop()}
                variant="destructive"
                size="sm"
                className="h-10 w-10 p-0 shrink-0"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!input.trim()}
                size="sm"
                className="h-10 w-10 p-0 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            {selectedCount} context file{selectedCount !== 1 ? 's' : ''} selected
            {messages.length > 0 && ` · ${messages.length} message${messages.length !== 1 ? 's' : ''}`}
            {totalGenerating > 0 && ` · ${totalGenerating} session${totalGenerating !== 1 ? 's' : ''} generating`}
          </p>
        </div>
      </div>
    </div>
  );
}
