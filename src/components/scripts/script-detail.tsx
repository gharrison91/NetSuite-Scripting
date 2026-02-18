'use client';

import { useState, useEffect } from 'react';
import { Script } from '@/types';
import { useFileContent } from '@/hooks/use-file-content';
import { parseJsDocHeader } from '@/lib/jsdoc-parser';
import { analyzeScript } from '@/lib/script-analyzer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, FileCode2, Wand2, Download, Copy, Check } from 'lucide-react';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import { useRouter, useSearchParams } from 'next/navigation';

interface ScriptDetailProps {
  script: Script;
  onBack: () => void;
}

export function ScriptDetail({ script, onBack }: ScriptDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchFile, loading } = useFileContent();
  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ReturnType<typeof parseJsDocHeader> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchFile(script.path).then((content) => {
      if (content) {
        setSourceCode(content);
        setMetadata(parseJsDocHeader(content));
      }
    });
  }, [script.path, fetchFile]);

  const handleEditInBuilder = () => {
    if (!sourceCode) return;
    const editData = {
      code: sourceCode,
      filename: script.filename,
      scriptType: script.type,
      path: script.path,
    };
    sessionStorage.setItem('scriptBuilder:editScript', JSON.stringify(editData));

    // Navigate to script-builder view
    const repoParam = searchParams.get('repo') || '';
    const branchParam = searchParams.get('branch') || 'main';
    router.push(`/dashboard?repo=${repoParam}&branch=${branchParam}&view=script-builder`);

    // Dispatch custom event so the always-mounted ScriptBuilder picks it up
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('scriptBuilder:editScript'));
    }, 100);
  };

  const handleDownload = () => {
    if (!sourceCode) return;
    const blob = new Blob([sourceCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = script.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!sourceCode) return;
    await navigator.clipboard.writeText(sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const analysis = sourceCode ? analyzeScript(sourceCode) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FileCode2 className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold font-mono">{script.filename}</h2>
        <Badge variant={script.isLatest ? 'default' : 'secondary'}>{script.version}</Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!sourceCode}>
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!sourceCode}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download
          </Button>
          <Button size="sm" onClick={handleEditInBuilder} disabled={!sourceCode}>
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            Edit in Builder
          </Button>
        </div>
      </div>

      {metadata && Object.keys(metadata).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {metadata.description && (
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-xs text-muted-foreground">Description</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-sm">{metadata.description}</p>
              </CardContent>
            </Card>
          )}
          {metadata.scriptType && (
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-xs text-muted-foreground">Script Type</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-sm">{metadata.scriptType}</p>
              </CardContent>
            </Card>
          )}
          {metadata.apiVersion && (
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-xs text-muted-foreground">API Version</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-sm">{metadata.apiVersion}</p>
              </CardContent>
            </Card>
          )}
          {metadata.dependencies && metadata.dependencies.length > 0 && (
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-xs text-muted-foreground">Dependencies</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 flex flex-wrap gap-1">
                {metadata.dependencies.map((dep) => (
                  <Badge key={dep} variant="outline" className="text-xs">
                    {dep}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
          {metadata.modules && metadata.modules.length > 0 && (
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-xs text-muted-foreground">Modules</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 flex flex-wrap gap-1">
                {metadata.modules.map((mod) => (
                  <Badge key={mod} variant="outline" className="text-xs">
                    {mod}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Script Analysis Summary */}
      {analysis && (analysis.uniqueFieldIds.length > 0 || analysis.modules.length > 0) && (
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-xs text-muted-foreground">Script Analysis</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            <p className="text-xs text-muted-foreground">{analysis.summary}</p>
            {analysis.modules.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {analysis.modules.map((m, i) => (
                  <Badge key={i} variant="outline" className="text-xs font-mono">
                    {m.module}
                  </Badge>
                ))}
              </div>
            )}
            {analysis.uniqueFieldIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {analysis.uniqueFieldIds.slice(0, 20).map((f) => (
                  <Badge key={f} variant="secondary" className="text-xs font-mono">
                    {f}
                  </Badge>
                ))}
                {analysis.uniqueFieldIds.length > 20 && (
                  <span className="text-xs text-muted-foreground">
                    +{analysis.uniqueFieldIds.length - 20} more
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <ContentSkeleton />
            </div>
          ) : sourceCode ? (
            <pre className="p-4 overflow-x-auto text-xs font-mono bg-muted/50 rounded-lg max-h-[600px] overflow-y-auto">
              <code>{sourceCode}</code>
            </pre>
          ) : (
            <div className="p-6 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading source code...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
