'use client';

import { useState, useMemo } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Inbox, FileCode2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';

export function InboxList() {
  const { tree } = useRepo();
  const { fetchFile, loading } = useFileContent();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const inboxFiles = useMemo(() => {
    const inboxDir = tree.find((n) => n.name === '_inbox' && n.type === 'directory');
    if (!inboxDir?.children) return [];
    return inboxDir.children.filter(
      (n) => n.type === 'file' && n.name !== 'README.md'
    );
  }, [tree]);

  const handlePreview = async (path: string) => {
    setSelectedFile(path);
    const content = await fetchFile(path);
    if (content) setPreview(content);
  };

  if (inboxFiles.length === 0) {
    return (
      <EmptyState
        title="Inbox Empty"
        description="No pending scripts in the _inbox/ folder."
        icon={Inbox}
      />
    );
  }

  if (selectedFile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setSelectedFile(null); setPreview(null); }}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileCode2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-mono">{selectedFile.split('/').pop()}</h3>
        </div>
        {loading ? (
          <ContentSkeleton />
        ) : preview ? (
          <pre className="p-4 border rounded-lg overflow-x-auto text-xs font-mono bg-muted/50 max-h-[600px] overflow-y-auto">
            <code>{preview}</code>
          </pre>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Script Inbox</h2>
        <Badge variant="secondary">{inboxFiles.length} items pending</Badge>
      </div>

      <div className="space-y-2">
        {inboxFiles.map((file) => (
          <Card
            key={file.path}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => handlePreview(file.path)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <FileCode2 className="h-4 w-4 text-muted-foreground" />
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

      <p className="text-xs text-muted-foreground">
        Click a file to preview its contents. To process these files, use Claude Code.
      </p>
    </div>
  );
}
