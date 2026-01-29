import JsonView from '@uiw/react-json-view';
import { nordTheme } from '@uiw/react-json-view/nord';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  className?: string;
  searchable?: boolean;
}

export function JsonViewer({ data, className, searchable = true }: JsonViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filterJson = (obj: any, term: string): any => {
    if (!term) return obj;
    
    // Deep filter logic
    if (Array.isArray(obj)) {
      return obj
        .map(v => filterJson(v, term))
        .filter(v => v !== undefined);
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const filtered: any = {};
      let hasMatch = false;
      
      for (const key in obj) {
        if (key.toLowerCase().includes(term.toLowerCase())) {
          filtered[key] = obj[key];
          hasMatch = true;
          continue;
        }
        
        const value = filterJson(obj[key], term);
        if (value !== undefined) {
          filtered[key] = value;
          hasMatch = true;
        }
      }
      
      return hasMatch ? filtered : undefined;
    }
    
    if (String(obj).toLowerCase().includes(term.toLowerCase())) {
      return obj;
    }
    
    return undefined;
  };

  const filteredData = searchTerm ? filterJson(data, searchTerm) : data;

  return (
    <div className={cn("space-y-4", className)}>
      {searchable && (
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search JSON..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}
      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4 overflow-auto max-h-[500px]">
        <JsonView 
          value={filteredData || {}} 
          style={nordTheme}
          displayDataTypes={false}
          displayObjectSize={true}
        />
        {searchTerm && !filteredData && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No matches found for "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
