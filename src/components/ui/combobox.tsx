'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronDown, Loader2, Search } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  allowFreeText?: boolean;
  icon?: React.ReactNode;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  loading = false,
  disabled = false,
  allowFreeText = false,
  icon,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync query with external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // If not free text, reset query to current value
        if (!allowFreeText && query !== value) {
          setQuery(value);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [allowFreeText, query, value]);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      (o.description && o.description.toLowerCase().includes(query.toLowerCase()))
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-combobox-item]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const selectOption = useCallback(
    (opt: ComboboxOption) => {
      setQuery(opt.label);
      onValueChange(opt.value);
      setOpen(false);
      setHighlightIndex(-1);
    },
    [onValueChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      e.preventDefault();
      return;
    }

    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          selectOption(filtered[highlightIndex]);
        } else if (allowFreeText && query.trim()) {
          onValueChange(query.trim());
          setOpen(false);
        }
        break;
      case 'Escape':
        setOpen(false);
        setHighlightIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setOpen(true);
            setHighlightIndex(-1);
            if (allowFreeText) {
              onValueChange(val);
            }
          }}
          onFocus={() => {
            if (options.length > 0 || loading) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(icon && 'pl-9', 'pr-8')}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {loading && filtered.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          )}

          {!loading && filtered.length === 0 && query && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Search className="h-4 w-4" />
              No results found
            </div>
          )}

          {!loading && filtered.length === 0 && !query && options.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              Type to search...
            </div>
          )}

          {filtered.map((opt, i) => (
            <button
              key={opt.value}
              data-combobox-item
              type="button"
              className={cn(
                'w-full text-left px-3 py-2 text-sm cursor-default transition-colors',
                i === highlightIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <div className="font-medium">{opt.label}</div>
              {opt.description && (
                <div className="text-xs text-muted-foreground truncate">
                  {opt.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
