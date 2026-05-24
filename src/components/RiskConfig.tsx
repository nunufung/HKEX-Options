import React from 'react';
import { RiskWeights, DEFAULT_WEIGHTS } from '../types';
import { Settings, Info } from 'lucide-react';

interface RiskConfigProps {
  weights: RiskWeights;
  onChange: (weights: RiskWeights) => void;
}

export default function RiskConfig({ weights, onChange }: RiskConfigProps) {
  const handleChange = (key: keyof RiskWeights, value: number) => {
    onChange({ ...weights, [key]: value });
  };

  const resetWeights = () => {
    onChange(DEFAULT_WEIGHTS);
  };

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
      <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-2">
        <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
          <Settings className="w-4 h-4 text-emerald-600" />
          風險權重配置
        </h3>
        <button 
          onClick={resetWeights}
          className="text-[10px] text-emerald-600 hover:text-emerald-700 font-extrabold uppercase"
        >
          重設為預設值
        </button>
      </div>

      <div className="space-y-4">
        {[
          { label: '時間價值衰減 (DTE)', key: 'dteWeight', color: 'bg-blue-500' },
          { label: '買賣價差 (Spread)', key: 'spreadWeight', color: 'bg-purple-500' },
          { label: '保證金效率', key: 'marginWeight', color: 'bg-orange-500' },
          { label: '隱含波動率 (IV)', key: 'ivWeight', color: 'bg-pink-500' },
          { label: '波動率百分位 (IV Rank)', key: 'ivRankWeight', color: 'bg-rose-500' },
          { label: 'Delta 風險控制', key: 'deltaWeight', color: 'bg-indigo-500' },
          { label: '流動性 (未平倉量)', key: 'liquidityWeight', color: 'bg-cyan-500' },
          { label: '安全邊際距離', key: 'safetyWeight', color: 'bg-emerald-500' },
        ].map((item) => (
          <div key={item.key} className="space-y-1">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
              <span className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${item.color}`}></div>
                {item.label}
              </span>
              <span className="font-mono text-slate-700 font-black">{weights[item.key as keyof RiskWeights]}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="5"
              value={weights[item.key as keyof RiskWeights]}
              onChange={(e) => handleChange(item.key as keyof RiskWeights, parseInt(e.target.value))}
              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 italic font-medium">
          <Info className="w-3.5 h-3.5" />
          權重總和必須為 100% 以確保準確度
        </div>
        <div className={`text-xs font-mono font-black ${total === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
          總計：{total}%
        </div>
      </div>
    </div>
  );
}
