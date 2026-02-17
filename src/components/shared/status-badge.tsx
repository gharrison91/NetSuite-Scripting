'use client';

import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: 'Active' | 'Deprecated' | 'Draft' | 'active' | 'deprecated' | 'draft' | 'pending';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  const variants: Record<string, { className: string; label: string }> = {
    active: { className: 'bg-green-500/15 text-green-600 border-green-500/30', label: 'Active' },
    deprecated: { className: 'bg-red-500/15 text-red-600 border-red-500/30', label: 'Deprecated' },
    draft: { className: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', label: 'Draft' },
    pending: { className: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', label: 'Pending' },
  };

  const v = variants[normalized] || variants.active;

  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}
