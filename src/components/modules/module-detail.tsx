'use client';

import { useState, useEffect, useMemo } from 'react';
import { Module, TreeNode } from '@/types';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ArrowLeft, Boxes, FileCode2, FileText, FolderOpen, Copy, Check } from 'lucide-react';

interface ModuleDetailProps {
  module: Partial<Module>;
  onBack: () => void;
}

/* ---- Large visual preview with dummy data ---- */
function LargeModulePreview({ module }: { module: Partial<Module> }) {
  const name = (module.name || '').toLowerCase();
  const purpose = (module.purpose || '').toLowerCase();

  const isPortlet = name.includes('portlet') || purpose.includes('portlet');
  const isSuitelet = name.includes('suitelet') || name.includes('form') || purpose.includes('suitelet') || purpose.includes('form');
  const isSearch = name.includes('search') || purpose.includes('search') || purpose.includes('list') || purpose.includes('results');
  const isSublist = name.includes('sublist') || purpose.includes('sublist') || purpose.includes('line item');
  const isRestlet = name.includes('restlet') || name.includes('api') || purpose.includes('rest') || purpose.includes('api endpoint');
  const isEmail = name.includes('email') || purpose.includes('email');
  const isPdf = name.includes('pdf') || purpose.includes('pdf');
  const isValidator = name.includes('valid') || purpose.includes('valid');

  if (isPortlet) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 text-sm">
        <div className="flex items-center justify-between mb-3 border-b pb-2">
          <span className="font-bold text-slate-700 dark:text-slate-300">{module.displayName || 'KPI Portlet'}</span>
          <div className="flex gap-2 text-xs text-slate-400">
            <span>Refresh</span>
            <span>[ - ]</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Open Orders', value: '24', color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Pending Invoices', value: '12', color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Revenue MTD', value: '$48.2K', color: 'text-emerald-600 dark:text-emerald-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="text-center p-3 rounded-lg bg-white dark:bg-slate-800 border">
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[
            { label: 'Overdue Payments', value: '3', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
            { label: 'Pending Approvals', value: '7', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
            { label: 'Completed Today', value: '15', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
          ].map((row) => (
            <div key={row.label} className={`flex justify-between items-center px-3 py-2 rounded border ${row.bg}`}>
              <span className="text-slate-600 dark:text-slate-300">{row.label}</span>
              <span className="font-mono font-bold">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isSuitelet) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 text-sm">
        <div className="mb-3 border-b pb-2">
          <span className="font-bold text-slate-700 dark:text-slate-300">{module.displayName || 'Suitelet Form'}</span>
          <span className="ml-2 text-xs text-slate-400">Custom Page</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Customer *</label>
            <div className="h-9 rounded border bg-white dark:bg-slate-700 px-3 flex items-center text-slate-600 dark:text-slate-300">
              Acme Corporation
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Transaction Type</label>
            <div className="h-9 rounded border bg-white dark:bg-slate-700 px-3 flex items-center text-slate-600 dark:text-slate-300">
              Invoice
              <span className="ml-auto text-slate-400">v</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Start Date</label>
            <div className="h-9 rounded border bg-white dark:bg-slate-700 px-3 flex items-center text-slate-600 dark:text-slate-300">
              01/01/2026
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">End Date</label>
            <div className="h-9 rounded border bg-white dark:bg-slate-700 px-3 flex items-center text-slate-600 dark:text-slate-300">
              12/31/2026
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Notes</label>
          <div className="h-16 rounded border bg-white dark:bg-slate-700 px-3 py-2 text-slate-400 text-xs">
            Enter additional notes here...
          </div>
        </div>
        <div className="flex gap-2 pt-4 border-t mt-4">
          <div className="h-9 px-5 rounded bg-blue-600 text-white flex items-center text-sm font-medium">Submit</div>
          <div className="h-9 px-5 rounded border text-slate-600 dark:text-slate-300 flex items-center text-sm">Cancel</div>
          <div className="h-9 px-5 rounded border text-slate-600 dark:text-slate-300 flex items-center text-sm">Reset</div>
        </div>
      </div>
    );
  }

  if (isSearch || isSublist) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 text-sm">
        <div className="mb-3 border-b pb-2 flex items-center justify-between">
          <span className="font-bold text-slate-700 dark:text-slate-300">{module.displayName || 'Search Results'}</span>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>1-25 of 142</span>
            <span className="px-2 py-0.5 border rounded">Export CSV</span>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <div className="flex-1 h-8 rounded border bg-white dark:bg-slate-700 px-3 flex items-center text-xs text-slate-400">
            Search...
          </div>
          <div className="h-8 px-4 rounded bg-blue-600 text-white flex items-center text-xs">Filter</div>
        </div>
        <div className="border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                <th className="text-left px-3 py-2 font-semibold">Name</th>
                <th className="text-left px-3 py-2 font-semibold">Type</th>
                <th className="text-right px-3 py-2 font-semibold">Qty</th>
                <th className="text-right px-3 py-2 font-semibold">Amount</th>
                <th className="text-center px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-500 dark:text-slate-400">
              {[
                { name: 'Widget Pro X', type: 'Inventory', qty: '150', amount: '$12,500', status: 'Active', statusColor: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
                { name: 'Service Plan A', type: 'Service', qty: '1', amount: '$8,000', status: 'Active', statusColor: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
                { name: 'Bulk Order #447', type: 'Assembly', qty: '500', amount: '$45,200', status: 'Pending', statusColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
                { name: 'Returns - Q4', type: 'Credit Memo', qty: '3', amount: '-$2,100', status: 'Closed', statusColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
              ].map((row) => (
                <tr key={row.name} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-3 py-2 text-blue-600 dark:text-blue-400 underline cursor-pointer">{row.name}</td>
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.qty}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.amount}</td>
                  <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] ${row.statusColor}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (isRestlet) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-gradient-to-b from-slate-900 to-slate-800 p-4 text-sm font-mono">
        <div className="mb-2 text-slate-400 text-xs">// RESTlet API Endpoint</div>
        <div className="space-y-2">
          <div><span className="text-green-400">GET</span> <span className="text-blue-400">/app/site/hosting/restlet.nl?script=123</span></div>
          <div className="pl-4 text-slate-400 text-xs">{'{'} &quot;status&quot;: &quot;ok&quot;, &quot;records&quot;: [...] {'}'}</div>
          <div className="mt-2"><span className="text-amber-400">POST</span> <span className="text-blue-400">/app/site/hosting/restlet.nl?script=123</span></div>
          <div className="pl-4 text-slate-400 text-xs">{'{'} &quot;action&quot;: &quot;create&quot;, &quot;data&quot;: {'{'} ... {'}'} {'}'}</div>
          <div className="mt-2"><span className="text-purple-400">PUT</span> <span className="text-blue-400">/app/site/hosting/restlet.nl?script=123&amp;id=456</span></div>
          <div className="mt-2"><span className="text-red-400">DELETE</span> <span className="text-blue-400">/app/site/hosting/restlet.nl?script=123&amp;id=456</span></div>
        </div>
      </div>
    );
  }

  if (isEmail) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 text-sm">
        <div className="border rounded bg-white dark:bg-slate-800 overflow-hidden">
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-700 border-b text-xs space-y-1">
            <div><span className="text-slate-400">To:</span> <span className="text-slate-600 dark:text-slate-300">customer@example.com</span></div>
            <div><span className="text-slate-400">Subject:</span> <span className="text-slate-600 dark:text-slate-300 font-medium">Invoice #INV-2026-001 - Payment Due</span></div>
          </div>
          <div className="p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <p>Dear <span className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'${customer.name}'}</span>,</p>
            <p>Your invoice <span className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'${invoice.tranid}'}</span> for <span className="font-bold bg-blue-100 dark:bg-blue-900 px-1 rounded">{'${invoice.total}'}</span> is due on <span className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'${invoice.duedate}'}</span>.</p>
            <p className="text-slate-400">---</p>
            <p className="text-[10px] text-slate-400">Attachment: invoice_INV-2026-001.pdf (42 KB)</p>
          </div>
        </div>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 text-sm">
        <div className="border rounded bg-white dark:bg-slate-800 p-6 shadow-sm max-w-md mx-auto">
          <div className="text-center border-b pb-3 mb-3">
            <div className="text-lg font-bold text-slate-700 dark:text-slate-300">INVOICE</div>
            <div className="text-xs text-slate-400">#INV-2026-001</div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs mb-4">
            <div>
              <div className="text-slate-400">Bill To:</div>
              <div className="text-slate-600 dark:text-slate-300">Acme Corp</div>
              <div className="text-slate-400">123 Main St</div>
            </div>
            <div className="text-right">
              <div className="text-slate-400">Date: 02/18/2026</div>
              <div className="text-slate-400">Due: 03/18/2026</div>
            </div>
          </div>
          <div className="border-t border-b py-2 text-xs">
            <div className="flex justify-between font-semibold text-slate-600 dark:text-slate-300">
              <span>Item</span><span>Amount</span>
            </div>
            <div className="flex justify-between text-slate-500 mt-1"><span>Consulting Services</span><span>$5,000</span></div>
            <div className="flex justify-between text-slate-500 mt-1"><span>Implementation</span><span>$3,200</span></div>
          </div>
          <div className="flex justify-between font-bold text-sm mt-2 text-slate-700 dark:text-slate-300">
            <span>Total</span><span>$8,200.00</span>
          </div>
        </div>
      </div>
    );
  }

  if (isValidator) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 text-sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Email *</label>
              <div className="h-9 rounded border-2 border-red-300 bg-white dark:bg-slate-700 px-3 flex items-center text-red-600">invalid-email</div>
            </div>
            <span className="text-red-500 text-xs mt-4">Invalid email format</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Phone *</label>
              <div className="h-9 rounded border-2 border-green-300 bg-white dark:bg-slate-700 px-3 flex items-center text-slate-600 dark:text-slate-300">(555) 123-4567</div>
            </div>
            <span className="text-green-500 text-xs mt-4">Valid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Amount *</label>
              <div className="h-9 rounded border-2 border-amber-300 bg-white dark:bg-slate-700 px-3 flex items-center text-amber-600">-50.00</div>
            </div>
            <span className="text-amber-500 text-xs mt-4">Must be positive</span>
          </div>
        </div>
      </div>
    );
  }

  // Generic fallback
  return (
    <div className="rounded-lg border-2 border-dashed bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 text-sm text-center text-slate-400">
      <Boxes className="h-12 w-12 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
      <p className="font-medium text-slate-600 dark:text-slate-300">{module.displayName || module.name}</p>
      <p className="text-xs mt-1">{module.purpose}</p>
    </div>
  );
}

export function ModuleDetail({ module, onBack }: ModuleDetailProps) {
  const { tree } = useRepo();
  const { fetchFile, loading } = useFileContent();
  const [readme, setReadme] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [tried, setTried] = useState(false);
  const [copied, setCopied] = useState(false);

  // Find module directory in tree
  const moduleDir = useMemo(() => {
    const modulesRoot = tree.find((n) => n.name === 'modules' && n.type === 'directory');
    if (!modulesRoot?.children) return null;

    const exact = modulesRoot.children.find(
      (n) => n.type === 'directory' && n.name === module.name
    );
    if (exact) return exact;

    const lower = (module.name || '').toLowerCase();
    return modulesRoot.children.find(
      (n) => n.type === 'directory' && n.name.toLowerCase() === lower
    ) || null;
  }, [tree, module.name]);

  const moduleFiles = useMemo(() => {
    if (!moduleDir?.children) return [];
    return moduleDir.children.filter((n) => n.type === 'file');
  }, [moduleDir]);

  // Try loading README
  useEffect(() => {
    const paths = [
      module.readmePath,
      moduleDir ? `${moduleDir.path}/README.md` : null,
      `modules/${module.name}/README.md`,
    ].filter((p): p is string => p !== null && p !== undefined);

    let cancelled = false;

    async function tryPaths() {
      for (const path of paths) {
        if (cancelled) return;
        const content = await fetchFile(path);
        if (content && !cancelled) {
          setReadme(content);
          return;
        }
      }
      if (!cancelled) setTried(true);
    }

    tryPaths();
    return () => { cancelled = true; };
  }, [module, moduleDir, fetchFile]);

  const handleViewSource = async (file: TreeNode) => {
    setSelectedSource(file.path);
    setSourceLoading(true);
    const content = await fetchFile(file.path);
    if (content) setSourceCode(content);
    setSourceLoading(false);
  };

  const handleCopyName = async () => {
    const text = module.name || module.displayName || '';
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Boxes className="h-5 w-5 text-purple-500" />
        <h2 className="text-lg font-semibold">{module.displayName || module.name}</h2>
        {module.currentVersion && (
          <Badge variant="secondary">{module.currentVersion}</Badge>
        )}
        {module.status && <StatusBadge status={module.status} />}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={handleCopyName}>
          {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
          {copied ? 'Copied!' : 'Copy Name'}
        </Button>
      </div>

      {module.purpose && (
        <p className="text-sm text-muted-foreground">{module.purpose}</p>
      )}

      {/* Visual UI Preview */}
      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-xs text-muted-foreground">Visual Preview (Dummy Data)</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <LargeModulePreview module={module} />
        </CardContent>
      </Card>

      {/* How to use in Script Builder */}
      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-xs text-muted-foreground">Use in Script Builder</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          <p className="text-xs text-muted-foreground">
            Copy the module name below and paste it into your Script Builder prompt:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded bg-muted font-mono text-sm">
              {module.name || module.displayName}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopyName}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Example prompt: &quot;Create a {module.displayName || module.name} that shows customer invoice data with filtering&quot;
          </p>
        </CardContent>
      </Card>

      {/* README content if found */}
      {loading && !tried ? (
        <ContentSkeleton />
      ) : readme ? (
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-xs text-muted-foreground">README</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <MarkdownRenderer content={readme} enableTableParsing />
          </CardContent>
        </Card>
      ) : null}

      {/* Module files browser */}
      {moduleFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span>
              {moduleFiles.length} file{moduleFiles.length !== 1 ? 's' : ''} in{' '}
              <code className="bg-muted px-1 rounded">{moduleDir?.path || `modules/${module.name}`}</code>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {moduleFiles.map((file) => (
              <Card
                key={file.path}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleViewSource(file)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  {file.name.endsWith('.js') ? (
                    <FileCode2 className="h-4 w-4 text-amber-400" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="flex-1 text-sm font-mono">{file.name}</span>
                  {file.size && (
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedSource && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                  <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono">{selectedSource.split('/').pop()}</span>
                </div>
                {sourceLoading ? (
                  <div className="p-6"><ContentSkeleton /></div>
                ) : sourceCode ? (
                  <pre className="p-4 overflow-x-auto text-xs font-mono bg-muted/50 rounded-b-lg max-h-[500px] overflow-y-auto">
                    <code>{sourceCode}</code>
                  </pre>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
