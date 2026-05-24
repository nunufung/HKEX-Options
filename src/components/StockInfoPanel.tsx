import React, { useState } from 'react';
import { StockInfo } from '../types';
import { ChevronDown, ChevronUp, Info, TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface StockInfoPanelProps {
  info: StockInfo | null;
  loading: boolean;
}

export default function StockInfoPanel({ info, loading }: StockInfoPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!info && !loading) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden transition-all shadow-xs">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-600" />
          <h3 className="text-[10px] uppercase tracking-widest text-[#64748b] font-black">個股盤面基本資訊</h3>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {loading ? (
            <div className="flex flex-col gap-2 py-4">
              <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse" />
              <div className="h-3 bg-slate-100 rounded w-2/3 animate-pulse" />
            </div>
          ) : info && (
            <div className="space-y-4 pt-2">
              {info.isFallback && (
                <div className="px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[9px] text-amber-700 font-bold uppercase flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  每日 API 額度已達上限（顯示過往快取離線數據）
                </div>
              )}
              <div>
                <h4 className="text-slate-800 font-black text-sm leading-tight">{info.name}</h4>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono font-black text-slate-900">${info.price > 0 ? info.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '--'}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">港幣 HKD</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-slate-50 rounded border border-slate-150/80 shadow-xs">
                  <div className="flex items-center gap-1.5 text-[9px] text-[#94a3b8] uppercase font-black mb-1">
                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                    52週最高價
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-800">${info.high52 > 0 ? info.high52.toLocaleString() : '--'}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-150/80 shadow-xs">
                  <div className="flex items-center gap-1.5 text-[9px] text-[#94a3b8] uppercase font-black mb-1">
                    <TrendingDown className="w-3 h-3 text-rose-500" />
                    52週最低價
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-800">${info.low52 > 0 ? info.low52.toLocaleString() : '--'}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-150/80 shadow-xs">
                  <div className="flex items-center gap-1.5 text-[9px] text-[#94a3b8] uppercase font-black mb-1">
                    <Activity className="w-3 h-3 text-blue-500" />
                    港股市值
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-800">{info.marketCap}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-150/80 shadow-xs">
                  <div className="flex items-center gap-1.5 text-[9px] text-[#94a3b8] uppercase font-black mb-1">
                    <DollarSign className="w-3 h-3 text-amber-500" />
                    歷史市盈率 P/E
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-800">{info.peRatio}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 uppercase font-black">股息收益率 (Dividend Yield)</span>
                  <span className="text-emerald-600 font-mono font-black">{info.dividendYield}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
