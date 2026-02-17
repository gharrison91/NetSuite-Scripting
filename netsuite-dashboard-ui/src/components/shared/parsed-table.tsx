'use client';

import { useState, useMemo } from 'react';
import { SearchFilter } from './search-filter';
import { ArrowUpDown } from 'lucide-react';

interface ParsedTableViewProps {
  headers: string[];
  rows: string[][];
  searchable?: boolean;
}

export function ParsedTableView({ headers, rows, searchable = false }: ParsedTableViewProps) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (search) {
      const term = search.toLowerCase();
      result = result.filter((row) =>
        row.some((cell) => cell.toLowerCase().includes(term))
      );
    }
    if (sortCol !== null) {
      result = [...result].sort((a, b) => {
        const av = a[sortCol] || '';
        const bv = b[sortCol] || '';
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return result;
  }, [rows, search, sortCol, sortAsc]);

  const handleSort = (colIndex: number) => {
    if (sortCol === colIndex) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(colIndex);
      setSortAsc(true);
    }
  };

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No data available</p>;
  }

  return (
    <div className="space-y-3 not-prose">
      {searchable && (
        <SearchFilter
          onFilter={setSearch}
          placeholder="Filter table..."
          value={search}
        />
      )}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-muted/80 select-none"
                  onClick={() => handleSort(i)}
                >
                  <span className="flex items-center gap-1">
                    {header}
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr key={i} className="border-t hover:bg-muted/30">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {searchable && (
        <p className="text-xs text-muted-foreground">
          Showing {filteredRows.length} of {rows.length} rows
        </p>
      )}
    </div>
  );
}
