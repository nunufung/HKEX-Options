import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface TickerInputProps {
  onAdd: (ticker: string) => void;
  watchedTickers: string[];
  onRemove: (ticker: string) => void;
  onSelect: (ticker: string) => void;
  selectedTicker: string;
}

export default function TickerInput({ onAdd, watchedTickers, onRemove, onSelect, selectedTicker }: TickerInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ ticker: string, name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = async (val: string) => {
    if (val.length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/search-ticker?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    fetchSuggestions(val);
    setShowSuggestions(true);
  };

  const handleAdd = (ticker: string) => {
    onAdd(ticker);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs" ref={containerRef}>
      <h3 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2">
        <Plus className="w-3.5 h-3.5 text-emerald-600" />
        個股分析與自訂監控名單
      </h3>
      
      <div className="relative mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => query && setShowSuggestions(true)}
            placeholder="輸入港股數字代號 (例如：700)"
            className="w-full bg-slate-50 border border-slate-200 rounded px-10 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 transition-colors placeholder:text-slate-400 font-semibold"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query) {
                handleAdd(query);
              }
            }}
          />
        </div>
        
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAdd(s.ticker)}
                className="w-full px-4 py-2.5 text-left text-[10px] hover:bg-slate-50 flex justify-between items-center transition-colors border-b border-slate-100 last:border-0"
              >
                <span className="text-slate-700 font-black">{s.name}</span>
                <span className="text-emerald-600 font-mono font-black tracking-tight">{s.ticker}.HK</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {watchedTickers.map(ticker => (
          <div 
            key={ticker}
            className={cn(
               "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer",
              selectedTicker === ticker 
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-black" 
                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            )}
            onClick={() => onSelect(ticker)}
          >
            <span>{ticker}.HK</span>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(ticker);
              }}
              className="hover:text-rose-600 text-slate-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {watchedTickers.length === 0 && (
          <span className="text-[10px] text-slate-400 italic">無自訂關注股號</span>
        )}
      </div>
    </div>
  );
}
