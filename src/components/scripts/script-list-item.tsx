'use client';

import { Script } from '@/types';
import { Badge } from '@/components/ui/badge';
import { FileCode2 } from 'lucide-react';

interface ScriptListItemProps {
  script: Script;
  onClick: () => void;
}

export function ScriptListItem({ script, onClick }: ScriptListItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left"
    >
      <FileCode2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm font-mono truncate">{script.baseName}</span>
      <Badge variant={script.isLatest ? 'default' : 'secondary'} className="text-xs">
        {script.version}
      </Badge>
      {script.isLatest && (
        <span className="text-xs text-green-600 dark:text-green-400">latest</span>
      )}
      {script.location.type !== 'shared' && (
        <Badge variant="outline" className="text-xs">
          {script.location.parent}
        </Badge>
      )}
    </button>
  );
}
