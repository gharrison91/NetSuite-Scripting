'use client';

import { useState, useEffect } from 'react';
import { Script } from '@/types';
import { useFileContent } from '@/hooks/use-file-content';
import { parseJsDocHeader } from '@/lib/jsdoc-parser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, FileCode2 } from 'lucide-react';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';

interface ScriptDetailProps {
  script: Script;
  onBack: () => void;
}

export function ScriptDetail({ script, onBack }: ScriptDetailProps) {
  const { fetchFile, loading } = useFileContent();
  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ReturnType<typeof parseJsDocHeader> | null>(null);

  useEffect(() => {
    fetchFile(script.path).then((content) => {
      if (content) {
        setSourceCode(content);
        setMetadata(parseJsDocHeader(content));
      }
    });
  }, [script.path, fetchFile]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FileCode2 className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold font-mono">{script.filename}</h2>
        <Badge variant={script.isLatest ? 'default' : 'secondary'}>{script.version}</Badge>
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
