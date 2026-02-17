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
  Code,
  Download,
  Send,
  Trash2,
  User,
  Bot,
  ChevronRight,
  ChevronLeft,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [view, setView] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState(false);

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
            <button
              onClick={() => setView('preview')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors',
                view === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Eye className="h-2.5 w-2.5" />
              Preview
            </button>
            <button
              onClick={() => setView('raw')}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors',
                view === 'raw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Code className="h-2.5 w-2.5" />
              Raw
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

      {view === 'preview' ? (
        message.htmlPreview ? (
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
        ) : (
          <div className="p-3 text-xs font-mono leading-relaxed overflow-x-auto bg-[#1a1b26] max-h-[500px] overflow-y-auto">
            {highlightCode(message.code)}
          </div>
        )
      ) : (
        <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre bg-muted/30 max-h-[500px] overflow-y-auto">
          <code>{message.code}</code>
        </pre>
      )}
    </div>
  );
}

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

  /* Chat state */
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cachedContext = useRef<{ name: string; content: string }[] | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Derived: active session & messages */
  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const messages = activeSession?.messages ?? [];
  const scriptType = activeSession?.scriptType ?? 'user-event';

  /* ---- Persistence ---- */

  // Load from localStorage on mount
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

  // Auto-create first session if none exist
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

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (initialized) {
      saveSessions(sessions);
    }
  }, [sessions, initialized]);

  // Save active ID
  useEffect(() => {
    if (initialized) {
      saveActiveId(activeId);
    }
  }, [activeId, initialized]);

  /* Auto-scroll */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, generating]);

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
    cachedContext.current = null;
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveId(id);
    setError(null);
    setInput('');
    cachedContext.current = null;
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
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

  const addMessage = useCallback(
    (msg: ChatMessage) => {
      if (!activeId) return;
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeId) return s;
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
    [activeId]
  );

  /* ---- Send message ---- */
  const handleSend = async () => {
    if (!input.trim() || generating || !config || !activeId) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input.trim(),
      code: null,
      htmlPreview: null,
    };

    addMessage(userMsg);
    setInput('');
    setGenerating(true);
    setError(null);

    try {
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

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.role === 'user' ? m.text : [m.text, m.code].filter(Boolean).join('\n\n'),
      }));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            scriptType,
            contextFiles: cachedContext.current,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Request failed (${res.status})`);
        }

        const data = await res.json();
        const parsed = parseAiResponse(data.code || '');

        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: parsed.text,
          code: parsed.code,
          htmlPreview: parsed.htmlPreview,
        });
      } catch (fetchErr) {
        clearTimeout(timeout);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error('Request timed out. Try a simpler prompt or fewer context files.');
        }
        throw fetchErr;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 100);
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
                        <MessageSquare className="h-2.5 w-2.5 shrink-0" />
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
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !generating ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3 max-w-md">
                <Wand2 className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <h3 className="text-sm font-medium">SuiteScript Chat</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Describe the script you need. You can iterate with follow-up messages
                  just like a normal conversation. For Suitelets and UI scripts, a visual
                  preview will be generated automatically.
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

              {generating && (
                <div className="flex gap-3 justify-start">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-muted/40 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Generating...</span>
                    </div>
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
            <Button
              onClick={handleSend}
              disabled={generating || !input.trim()}
              size="sm"
              className="h-10 w-10 p-0 shrink-0"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            {selectedCount} context file{selectedCount !== 1 ? 's' : ''} selected
            {messages.length > 0 && ` · ${messages.length} message${messages.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>
    </div>
  );
}
