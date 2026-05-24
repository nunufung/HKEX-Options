import { useState, useMemo } from 'react';
import { OptionData, RiskWeights } from '../types';
import { evaluateOption } from '../DecisionEngine';
import { formatPercent, cn, downloadCSV } from '../lib/utils';
import { AlertCircle, CheckCircle2, XCircle, AlertTriangle, Download, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface CandidatesTableProps {
  options: OptionData[];
  weights: RiskWeights;
  onTickerClick: (ticker: string) => void;
}

export default function CandidatesTable({ options, weights, onTickerClick }: CandidatesTableProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minDte: 0,
    maxDte: 120,
    minIvRank: 0,
    maxIvRank: 100,
    minDelta: 0,
    maxDelta: 0.5
  });

  const filteredOptions = useMemo(() => {
    return options.filter(opt => {
      const dte = opt.dte || 0;
      const absDelta = Math.abs(opt.delta);
      const ivr = opt.ivRank || 0;

      return (
        dte >= filters.minDte &&
        dte <= filters.maxDte &&
        ivr >= filters.minIvRank &&
        ivr <= filters.maxIvRank &&
        absDelta >= filters.minDelta &&
        absDelta <= filters.maxDelta
      );
    });
  }, [options, filters]);

  const evaluated = useMemo(() => {
    return filteredOptions.map(opt => ({
      ...opt,
      decision: evaluateOption(opt, weights)
    })).sort((a, b) => b.decision.score - a.decision.score);
  }, [filteredOptions, weights]);

  const best = evaluated.filter(e => e.decision.action === '做');
  const rejected = evaluated.filter(e => e.decision.action === '不做');

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-4 py-3 flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-3 h-3 text-emerald-600" />
            進階篩選條件
          </div>
          {showFilters ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
        </button>
        
        {showFilters && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400">到期天數 (DTE) 區間 ({filters.minDte} - {filters.maxDte} 天)</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" min="0" max="120" value={filters.minDte}
                  onChange={(e) => setFilters({...filters, minDte: parseInt(e.target.value)})}
                  className="flex-1 accent-emerald-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                />
                <input 
                  type="range" min="0" max="120" value={filters.maxDte}
                  onChange={(e) => setFilters({...filters, maxDte: parseInt(e.target.value)})}
                  className="flex-1 accent-emerald-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400">隱含波動率百分位 (IV Rank) ({filters.minIvRank}% - {filters.maxIvRank}%)</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" min="0" max="100" value={filters.minIvRank}
                  onChange={(e) => setFilters({...filters, minIvRank: parseInt(e.target.value)})}
                  className="flex-1 accent-emerald-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                />
                <input 
                  type="range" min="0" max="100" value={filters.maxIvRank}
                  onChange={(e) => setFilters({...filters, maxIvRank: parseInt(e.target.value)})}
                  className="flex-1 accent-emerald-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400">Delta 範圍 ({filters.minDelta.toFixed(2)} - {filters.maxDelta.toFixed(2)})</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" min="0" max="1" step="0.01" value={filters.minDelta}
                  onChange={(e) => setFilters({...filters, minDelta: parseFloat(e.target.value)})}
                  className="flex-1 accent-emerald-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                />
                <input 
                  type="range" min="0" max="1" step="0.01" value={filters.maxDelta}
                  onChange={(e) => setFilters({...filters, maxDelta: parseFloat(e.target.value)})}
                  className="flex-1 accent-emerald-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prime Candidates */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">符合資格交易機會 ({best.length})</h3>
          <button 
            onClick={() => downloadCSV(best, `candidates_${new Date().toISOString().split('T')[0]}.csv`)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-650 hover:text-slate-900 border border-slate-200 shadow-xs rounded text-[9px] uppercase font-bold transition-colors"
          >
            <Download className="w-3 h-3 text-slate-500" />
            匯出 CSV
          </button>
        </div>
        <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-xs">
          <table className="w-full text-xs font-mono">
            <thead className="bg-[#f8fafc] text-slate-500 border-b border-slate-150">
              <tr>
                <th className="p-3 text-left uppercase text-[9px]">股票代號</th>
                <th className="p-3 text-left uppercase text-[9px]">期權類型</th>
                <th className="p-3 text-left uppercase text-[9px]">到期天數 (DTE)</th>
                <th className="p-3 text-left uppercase text-[9px]">Delta</th>
                <th className="p-3 text-left uppercase text-[9px]">波動比 (IVR)</th>
                <th className="p-3 text-left uppercase text-[9px] text-right">綜合評分</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {best.slice(0, 5).map((opt, i) => (
                <tr 
                  key={i} 
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onTickerClick(opt.symbol)}
                >
                  <td className="p-3 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      {opt.symbol}
                      {opt.dte && opt.dte < 21 && (
                        <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" title="Approaching Expiry" />
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wider",
                      opt.type === 'Put' 
                        ? 'bg-rose-50 border-rose-200 text-rose-700' 
                        : 'bg-cyan-50 border-cyan-200 text-cyan-700'
                    )}>
                      {opt.type === 'Put' ? '認沽 Put' : '認購 Call'} @ {opt.strike}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <span className={cn(opt.dte && opt.dte < 21 ? 'text-orange-600 font-bold' : 'text-slate-600')}>
                        {opt.dte || '--'}
                      </span>
                      {opt.dte && opt.dte < 21 && (
                        <AlertTriangle className="w-3 h-3 text-orange-500 animate-pulse" />
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={cn(
                      "font-bold font-mono",
                      opt.delta < 0 ? 'text-rose-600' : 'text-cyan-600'
                    )}>
                      {opt.delta ? opt.delta.toFixed(2) : '--'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-bold border',
                      opt.ivRank > 50 
                        ? 'bg-amber-50 border-amber-200 text-amber-700' 
                        : 'bg-slate-50 border-slate-100 text-slate-500'
                    )}>
                      {opt.ivRank}%
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className={cn(
                      "px-2 py-0.5 rounded font-black text-xs font-mono border",
                      opt.decision.score >= 80 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                    )}>
                      {opt.decision.score}
                    </span>
                  </td>
                </tr>
              ))}
              {best.length === 0 && (
                <tr>
                   <td colSpan={6} className="p-8 text-center text-slate-400 italic uppercase text-[10px]">當前無符合篩選條件的高評分機會</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rejected Options */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">系統排除過濾對象</h3>
        <div className="flex flex-col gap-2">
          {rejected.slice(0, 6).map((opt, i) => (
            <div 
              key={i} 
              className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded group hover:border-rose-400 transition-colors cursor-pointer shadow-xs"
              onClick={() => onTickerClick(opt.symbol)}
            >
              <span className="text-xs font-mono text-slate-650 font-semibold group-hover:text-slate-900 transition-colors">
                {opt.symbol} ({opt.type === 'Put' ? '認沽 Put' : '認購 Call'}) @ {opt.strike}
              </span>
              <span className="text-[9px] px-2 py-0.5 bg-slate-50 border border-slate-100/50 text-slate-405 rounded uppercase font-bold group-hover:bg-rose-50 group-hover:text-rose-600 transition-all">
                {opt.decision.reason}
              </span>
            </div>
          ))}
          {rejected.length === 0 && (
            <div className="p-4 text-center border border-dashed border-slate-200 rounded text-slate-405 text-[10px] uppercase">
              暫無排除記錄
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
