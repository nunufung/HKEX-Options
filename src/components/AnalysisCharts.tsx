import React, { useEffect, useState } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { HistoricalData } from '../types';
import { TrendingUp, BarChart } from 'lucide-react';
import { cn } from '../lib/utils';

interface AnalysisChartsProps {
  ticker: string;
}

export default function AnalysisCharts({ ticker }: AnalysisChartsProps) {
  const [data, setData] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    fetch(`/api/historical-data/${ticker}`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [ticker]);

  if (!ticker) return null;

  const [activeTab, setActiveTab] = useState<'price' | 'iv'>('price');

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs" id="analysis-charts-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4 pb-2 border-b border-slate-100">
        <h3 className="text-[10px] font-black uppercase text-[#64748b] flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
          標的數據觀測：<span className="text-slate-800 font-mono">{ticker}.HK</span>
        </h3>
        
        {/* Sleek Segment Selectors */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/40">
          <button
            type="button"
            onClick={() => setActiveTab('price')}
            className={cn(
              "px-2.5 py-1 text-[9px] font-bold uppercase transition-all rounded-md flex items-center gap-1 tracking-tight",
              activeTab === 'price'
                ? "bg-white text-emerald-700 shadow-3xs"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            價格走勢
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('iv')}
            className={cn(
              "px-2.5 py-1 text-[9px] font-bold uppercase transition-all rounded-md flex items-center gap-1 tracking-tight",
              activeTab === 'iv'
                ? "bg-white text-indigo-700 shadow-3xs"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            隱含波動 (IV)
          </button>
        </div>
      </div>

      <div className="h-[175px] w-full">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">數據載入中...</span>
          </div>
        ) : activeTab === 'price' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 9 }}
                minTickGap={25}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 9 }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px -5px rgba(0,0,0,0.05)' }}
                labelStyle={{ color: '#475569', fontWeight: 'bold', fontSize: 10 }}
                itemStyle={{ fontSize: 10 }}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#059669" 
                strokeWidth={2.5} 
                dot={false} 
                activeDot={{ r: 4, strokeWidth: 0, fill: '#059669' }}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorIv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 9 }}
                minTickGap={25}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 9 }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px -5px rgba(0,0,0,0.05)' }}
                labelStyle={{ color: '#475569', fontWeight: 'bold', fontSize: 10 }}
                itemStyle={{ fontSize: 10 }}
              />
              <Area 
                type="monotone" 
                dataKey="iv" 
                stroke="#4f46e5" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorIv)" 
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
