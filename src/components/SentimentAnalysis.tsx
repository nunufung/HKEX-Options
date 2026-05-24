import React, { useState } from 'react';
import { Search, BrainCircuit, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface SentimentResult {
  name: string;
  summary: string;
  risk: string;
  sentiment?: string;
}

interface NewsItem {
  id: number;
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'caution';
  date: string;
}

interface SentimentAnalysisProps {
  currentTicker?: string;
  news?: NewsItem[];
  onAddToMonitor?: (ticker: string) => void;
  isCustomMonitored?: (ticker: string) => boolean;
}

export default function SentimentAnalysis({ currentTicker, news = [], onAddToMonitor, isCustomMonitored }: SentimentAnalysisProps) {
  const [ticker, setTicker] = useState(currentTicker || '');
  const [analyzedTicker, setAnalyzedTicker] = useState(currentTicker || '');
  const [suggestions, setSuggestions] = useState<{ ticker: string, name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [result, setResult] = useState<SentimentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (currentTicker) {
      setTicker(currentTicker);
      setAnalyzedTicker(currentTicker);
    }
  }, [currentTicker]);

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
    setTicker(val);
    fetchSuggestions(val);
    setShowSuggestions(true);
  };

  const selectSuggestion = (s: { ticker: string, name: string }) => {
    setTicker(s.ticker);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleAnalyze = async () => {
    if (!ticker) return;
    setLoading(true);
    setError('');
    setResult(null);
    setShowSuggestions(false);
    const trimmed = ticker.trim();
    setAnalyzedTicker(trimmed);

    try {
      const response = await fetch('/api/analyze-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: trimmed }),
      });

      if (!response.ok) throw new Error('Failed to fetch sentiment');
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError('Error analyzing ticker. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.suggestion-container')) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs relative">
      <h3 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
        <BrainCircuit className="w-4 h-4 text-emerald-600" />
        AI 輿情偵察員
      </h3>
      
      <div className="flex gap-2 mb-4 relative suggestion-container">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={ticker}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => ticker && setShowSuggestions(true)}
            placeholder="搜尋公司名稱或股票代號"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded px-10 py-2 text-sm focus:outline-none focus:border-emerald-600 transition-colors placeholder:text-slate-400 font-semibold"
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectSuggestion(s)}
                  className="w-full px-4 py-2.5 text-left text-xs hover:bg-slate-50 flex justify-between items-center transition-colors border-b border-slate-100 last:border-0"
                >
                  <span className="text-slate-700 font-black">{s.name}</span>
                  <span className="text-emerald-600 font-mono font-black tracking-tight">{s.ticker}.HK</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading || !ticker}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-extrabold px-4 py-2 rounded text-sm transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '分析'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200/60 rounded text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          分析股號出錯。請重試。
        </div>
      )}

      {result && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">分析結果: {result.name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    "text-[8px] px-1.5 py-0.5 rounded uppercase font-black border animate-pulse",
                    result.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    result.sentiment === 'negative' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    'bg-amber-50 text-amber-700 border-amber-205'
                  )}>
                    {result.sentiment === 'positive' ? '看漲 Positive' :
                     result.sentiment === 'negative' ? '看跌 Negative' :
                     '中立 Neutral'}
                  </span>
                </div>
              </div>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded uppercase font-black text-white shadow-xs",
                result.risk.toLowerCase() === 'high' ? 'bg-rose-600' :
                result.risk.toLowerCase() === 'medium' ? 'bg-amber-500' :
                'bg-emerald-600'
              )}>
                {result.risk.toLowerCase() === 'high' ? '高風險 High' :
                 result.risk.toLowerCase() === 'medium' ? '中風險 Medium' :
                 '低風險 Low'}
              </span>
            </div>
             <p className="text-sm text-slate-650 italic leading-relaxed font-semibold">
              "{result.summary}"
            </p>
            {onAddToMonitor && analyzedTicker && (
              <button
                onClick={() => onAddToMonitor(analyzedTicker)}
                disabled={isCustomMonitored?.(analyzedTicker)}
                className={cn(
                  "w-full py-2 px-3 rounded text-[10px] uppercase tracking-wider font-extrabold transition-all flex items-center justify-center gap-1.5 mt-3 border transition-all duration-300",
                  isCustomMonitored?.(analyzedTicker)
                    ? "bg-slate-105 border-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white shadow-xs select-none active:scale-[0.98] cursor-pointer"
                )}
              >
                {isCustomMonitored?.(analyzedTicker) ? (
                  <>✓ 追蹤中</>
                ) : (
                  <>+ 自訂追蹤 {analyzedTicker}.HK</>
                )}
              </button>
            )}
          </div>

          {/* News Sentiment Feed Integration */}
          {news.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h4 className="text-[9px] uppercase font-black text-slate-400 mb-2 flex items-center justify-between">
                新聞輿情脈搏
                <span className="text-[8px] font-normal opacity-50">最新動態</span>
              </h4>
              <div className="flex gap-1 h-1 mb-3">
                {news.map((item, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex-1 rounded-full",
                      item.sentiment === 'positive' ? 'bg-emerald-500' :
                      item.sentiment === 'negative' ? 'bg-rose-500' :
                      'bg-amber-500'
                    )}
                  />
                ))}
              </div>
              <div className="space-y-2">
                {news.slice(0, 2).map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <div className={cn(
                      "w-1 h-3 mt-0.5 shrink-0 rounded-full",
                      item.sentiment === 'positive' ? 'bg-emerald-500' :
                      item.sentiment === 'negative' ? 'bg-rose-500' :
                      'bg-amber-500'
                    )} />
                    <p className="text-[10px] text-slate-600 font-semibold line-clamp-1">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <p className="text-[10px] text-slate-400 uppercase text-center py-4 font-bold">
          輸入股號以預覽 AI 智能市場輿情分析
        </p>
      )}
    </div>
  );
}
