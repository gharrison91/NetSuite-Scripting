'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { useFileContent } from '@/hooks/use-file-content';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContentSkeleton } from '@/components/shared/loading-skeleton';
import {
  FileCode2, ArrowLeft, Upload, CheckCircle, XCircle,
  Loader2, FileUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadStatus {
  filename: string;
  status: 'uploading' | 'success' | 'error';
  message?: string;
}

export function InboxList() {
  const { tree, config, refreshRepo } = useRepo();
  const { fetchFile, loading } = useFileContent();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!config || files.length === 0) return;
    setIsUploading(true);
    const statuses: UploadStatus[] = files.map((f) => ({
      filename: f.name,
      status: 'uploading' as const,
    }));
    setUploads(statuses);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const content = await file.text();
        const res = await fetch('/api/repo/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: config.owner,
            repo: config.repo,
            branch: config.branch,
            path: `_inbox/${file.name}`,
            content,
            message: `Add ${file.name} to inbox via dashboard`,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }));
          setUploads((prev) =>
            prev.map((u, j) => j === i ? { ...u, status: 'error', message: err.error } : u)
          );
        } else {
          setUploads((prev) =>
            prev.map((u, j) => j === i ? { ...u, status: 'success' } : u)
          );
        }
      } catch (err) {
        setUploads((prev) =>
          prev.map((u, j) => j === i ? { ...u, status: 'error', message: err instanceof Error ? err.message : 'Upload failed' } : u)
        );
      }
    }

    setIsUploading(false);
    // Refresh the repo tree to show new files
    setTimeout(() => refreshRepo(), 1000);
  }, [config, refreshRepo]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith('.js') || f.name.endsWith('.ts') || f.name.endsWith('.json') || f.name.endsWith('.md')
    );

    if (files.length > 0) {
      uploadFiles(files);
    }
  }, [uploadFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      uploadFiles(files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadFiles]);

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
    <div
      className="space-y-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Script Inbox</h2>
        <div className="flex items-center gap-2">
          {inboxFiles.length > 0 && (
            <Badge variant="secondary">{inboxFiles.length} items pending</Badge>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".js,.ts,.json,.md"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={!config || isUploading}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload Files
          </Button>
        </div>
      </div>

      {/* Drag-and-drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-muted-foreground/20 hover:border-muted-foreground/40',
          inboxFiles.length === 0 && !isDragging && 'py-16'
        )}
      >
        <FileUp className={cn(
          'h-10 w-10 mx-auto mb-3 transition-colors',
          isDragging ? 'text-primary' : 'text-muted-foreground/40'
        )} />
        <p className={cn(
          'text-sm font-medium transition-colors',
          isDragging ? 'text-primary' : 'text-muted-foreground'
        )}>
          {isDragging ? 'Drop files here to upload' : 'Drag & drop scripts here'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Accepts .js, .ts, .json, and .md files. Files will be uploaded to <code className="bg-muted px-1 rounded">_inbox/</code>
        </p>
      </div>

      {/* Upload status */}
      {uploads.length > 0 && (
        <div className="space-y-1.5">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-muted/50">
              {u.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              {u.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
              {u.status === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive" />}
              <span className="font-mono text-xs flex-1">{u.filename}</span>
              {u.message && <span className="text-xs text-destructive">{u.message}</span>}
              {u.status === 'success' && <span className="text-xs text-green-500">Uploaded</span>}
            </div>
          ))}
        </div>
      )}

      {/* Existing inbox files */}
      {inboxFiles.length > 0 && (
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
      )}

      {inboxFiles.length === 0 && uploads.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          No pending scripts. Drop files here or click Upload to add scripts to the inbox.
        </p>
      )}
    </div>
  );
}
