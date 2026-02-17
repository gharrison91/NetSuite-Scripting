'use client';

import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SearchFilterProps {
  onFilter: (term: string) => void;
  placeholder?: string;
  value?: string;
}

export function SearchFilter({ onFilter, placeholder = 'Search...', value }: SearchFilterProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onFilter(e.target.value)}
      />
    </div>
  );
}
