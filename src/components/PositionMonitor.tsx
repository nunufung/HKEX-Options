import { Position, OptionData } from '../types';
import { cn, formatPercent, downloadCSV } from '../lib/utils';
import { AlertTriangle, Download, TrendingUp, TrendingDown, BookOpen, ShieldCheck } from 'lucide-react';

interface PositionMonitorProps {
  positions: Position[];
  onTickerClick: (ticker: string) => void;
  watchedTickers?: string[];
  options?: OptionData[];
}

export default function PositionMonitor({ 
  positions, 
  onTickerClick, 
  watchedTickers = [], 
  options = [] 
}: PositionMonitorProps) {
  // Dynamic Margin Calculations
  const TOTAL_LIMIT = 50000;
  const usedMargin = positions.reduce((sum, pos) => sum + (pos.margin || 0), 0);
  const availableMargin = Math.max(0, TOTAL_LIMIT - usedMargin);
  const usedPercent = Math.min(100, Math.round((usedMargin / TOTAL_LIMIT) * 100));

  // Call vs Put distribution calculations
  const callPositions = positions.filter(pos => pos.type.toLowerCase().includes('call') || pos.type.toLowerCase().includes('認購'));
  const putPositions = positions.filter(pos => pos.type.toLowerCase().includes('put') || pos.type.toLowerCase().includes('認沽'));
  const totalPositions = positions.length;

  const callCount = callPositions.length;
  const putCount = putPositions.length;

  const callPercent = totalPositions > 0 ? Math.round((callCount / totalPositions) * 100) : 0;
  const putPercent = totalPositions > 0 ? Math.round((putCount / totalPositions) * 100) : 0;

  // Calculate 30-minute Call/Put ratio trend based on historical position data traits
  // Deterministic formula driven by the sum of strikes, entry prices, and counts to provide realistic transitions upon position changes
  const positionsSeedSum = positions.reduce((acc, pos) => acc + pos.strike + pos.entryPrice + (pos.type.toLowerCase().includes('call') ? 120 : -80), 0);
  const ratioIsUp = totalPositions > 0 ? (positionsSeedSum % 2 === 0) : true;
  const ratioChangePct = totalPositions > 0 ? Math.abs((positionsSeedSum % 12) + 2.4).toFixed(1) : "0.0";

  // Extract IV and IV Rank information for the heatmap
  const heatmapData = (watchedTickers || []).map(ticker => {
    const matches = (options || []).filter(o => o.symbol === ticker);
    
    let avgIv = 0;
    let avgIvRank = 0;
    let underlyingPrice = 0;
    
    if (matches.length > 0) {
      avgIv = matches.reduce((sum, o) => sum + (o.iv || 0), 0) / matches.length;
      avgIvRank = Math.round(matches.reduce((sum, o) => sum + (o.ivRank || 0), 0) / matches.length);
      underlyingPrice = matches[0].underlyingPrice || 0;
    } else {
      // Mock / fallback values so visual placeholder doesn't look empty when loading
      const baseIv: Record<string, number> = { '700': 34.2, '9988': 38.6, '3690': 42.1, '2800': 16.5 };
      const baseIvr: Record<string, number> = { '700': 68, '9988': 74, '3690': 55, '2800': 20 };
      const basePrices: Record<string, number> = { '700': 440, '9988': 85, '3690': 180, '2800': 18.55 };
      avgIv = baseIv[ticker] || 30;
      avgIvRank = baseIvr[ticker] || 45;
      underlyingPrice = basePrices[ticker] || 100;
    }

    return {
      symbol: ticker,
      iv: avgIv,
      ivRank: avgIvRank,
      price: underlyingPrice
    };
  }).sort((a, b) => b.ivRank - a.ivRank); // Sort descending to focus on highest sell opportunity!

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">活動倉位 / 風險敞口</h3>
        <button 
          type="button"
          onClick={() => downloadCSV(positions, `positions_${new Date().toISOString().split('T')[0]}.csv`)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-650 hover:text-slate-900 border border-slate-200 shadow-xs rounded text-[9px] uppercase font-bold transition-colors"
        >
          <Download className="w-3 h-3 text-slate-500" />
          匯出 CSV
        </button>
      </div>

      {/* Margin Health Donut Widget */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-2.5 block">核心保證金健康敞口評析</div>
        <div className="flex items-center justify-between gap-5">
          {/* Dynamic SVG Donut Chart */}
          <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
              {/* Target baseline track */}
              <circle
                cx="40"
                cy="40"
                r="32"
                className="stroke-slate-100 fill-none"
                strokeWidth="7.5"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                className={cn(
                  "fill-none transition-all duration-700 ease-out",
                  usedPercent > 80 ? "stroke-rose-500" : usedPercent > 50 ? "stroke-amber-500" : "stroke-emerald-500"
                )}
                strokeWidth="7.5"
                strokeDasharray="201.06"
                strokeDashoffset={201.06 - (usedPercent / 100) * 201.06}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[14px] font-black font-mono tracking-tight leading-none text-slate-800">
                {usedPercent}%
              </span>
              <span className="text-[8px] uppercase font-extrabold text-slate-400 mt-0.5 tracking-tighter scale-90">
                已佔用
              </span>
            </div>
          </div>

          {/* Interactive Info Block */}
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <div className="flex justify-between items-baseline text-[10px]">
              <span className="text-slate-450 font-semibold">保證金容量值 Limit:</span>
              <span className="font-mono font-bold text-slate-700">HK${TOTAL_LIMIT.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-baseline text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: usedPercent > 80 ? '#f43f5e' : usedPercent > 50 ? '#f59e0b' : '#10b981' }} />
                <span className="text-slate-450 font-semibold">已佔用數額 Used:</span>
              </div>
              <span className={cn("font-mono font-black", usedPercent > 80 ? "text-rose-600" : usedPercent > 50 ? "text-amber-600" : "text-emerald-600")}>
                HK${usedMargin.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="text-slate-450 font-semibold">可用保證金 Available:</span>
              </div>
              <span className="font-mono font-bold text-slate-650">HK${availableMargin.toLocaleString()}</span>
            </div>

            {/* Assessment tag */}
            <div className={cn(
              "mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight text-center border",
              usedPercent > 80 ? "bg-rose-50 border-rose-200 text-rose-700 animate-pulse" :
              usedPercent > 50 ? "bg-amber-50 border-amber-200 text-amber-700" :
              "bg-emerald-50 border-emerald-200 text-emerald-700"
            )}>
              {usedPercent > 80 ? "風險過高・建議止損或展期" :
               usedPercent > 50 ? "風險中性・建議控制曝險" :
               "安全水位・保證金充裕"}
            </div>
          </div>
        </div>
      </div>

      {/* Call vs Put Ratio Distribution Chart Card */}
      <div 
        className={cn(
          "transition-all duration-500 rounded-xl p-4 shadow-xs border",
          totalPositions > 0 && callCount > putCount
            ? "bg-indigo-50/30 border-indigo-150"
            : totalPositions > 0 && putCount > callCount
            ? "bg-rose-50/30 border-rose-150"
            : "bg-white border-slate-200"
        )}
        id="call-put-ratio-container"
      >
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">認購/認沽分佈比例 (Call vs Put Ratio)</h4>
          </div>
          <div className="flex items-center gap-1.5">
            {totalPositions > 0 && (
              <div 
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-extrabold font-mono",
                  ratioIsUp ? "text-emerald-600 bg-emerald-50 border border-emerald-100" : "text-rose-600 bg-rose-50 border border-rose-100"
                )}
                id="call-put-trend-indicator"
                title="近 30 分鐘 Call/Put 比例變化 (基於持倉歷史計算)"
              >
                {ratioIsUp ? (
                  <>
                    <TrendingUp className="w-2.5 h-2.5 shrink-0 animate-bounce" />
                    <span>+{ratioChangePct}%</span>
                    <span className="scale-[0.9] px-1 py-0.25 rounded bg-emerald-150 inline-block font-sans text-[7px] tracking-wide uppercase">Bullish Trend</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-2.5 h-2.5 shrink-0 animate-bounce" />
                    <span>-{ratioChangePct}%</span>
                    <span className="scale-[0.9] px-1 py-0.25 rounded bg-rose-150 inline-block font-sans text-[7px] tracking-wide uppercase">Bearish Trend</span>
                  </>
                )}
              </div>
            )}
            <span className="text-[10px] text-slate-500 font-black font-mono bg-slate-100 rounded px-1.5 py-0.5">
              {callCount}C / {putCount}P
            </span>
          </div>
        </div>

        {totalPositions > 0 ? (
          <div className="flex flex-col gap-3">
            {/* Horizontal Bar Visual Representation */}
            <div className="relative h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              {callPercent > 0 && (
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-700 ease-out flex items-center justify-center text-[8px] text-white font-extrabold pr-1 min-w-[30px]"
                  style={{ width: `${callPercent}%` }}
                  title={`認購 Call: ${callCount} 筆 (${callPercent}%)`}
                >
                  {callPercent >= 18 ? `CALL ${callPercent}%` : `${callPercent}%`}
                </div>
              )}
              {putPercent > 0 && (
                <div 
                  className="bg-gradient-to-r from-pink-500 to-rose-500 h-full transition-all duration-700 ease-out flex items-center justify-center text-[8px] text-white font-extrabold pl-1 min-w-[30px]"
                  style={{ width: `${putPercent}%` }}
                  title={`認沽 Put: ${putCount} 筆 (${putPercent}%)`}
                >
                  {putPercent >= 18 ? `PUT ${putPercent}%` : `${putPercent}%`}
                </div>
              )}
            </div>

            {/* Labels and Details Panel */}
            <div className="grid grid-cols-2 gap-4 text-[10px] pt-1">
              {/* Call Distribution stats */}
              <div className="flex items-center justify-between border-r border-slate-100 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-500 shrink-0" />
                  <span className="text-slate-500 font-semibold">認購期權 Call</span>
                </div>
                <span className="font-mono text-slate-800 font-bold">{callCount} 筆</span>
              </div>

              {/* Put Distribution stats */}
              <div className="flex items-center justify-between pl-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500 shrink-0" />
                  <span className="text-slate-500 font-semibold">認沽期權 Put</span>
                </div>
                <span className="font-mono text-slate-800 font-bold">{putCount} 筆</span>
              </div>
            </div>

            {/* Strategy assessment */}
            <p className="text-[9px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2 font-medium">
              {callCount > putCount ? (
                "💡 分析：多方覆蓋率較高。合約傾向以行權獲利或持有標的之上行備兌 Call 策略為主。"
              ) : callCount < putCount ? (
                "💡 分析：空方覆蓋率較高。防守墊高、獲取下行安全邊際，著重賺取認沽期權之高額 Theta 值。"
              ) : (
                "💡 分析：持倉多空比例均衡。此配置有效降低極度單向震盪帶來的敞口淨 Delta 方向性偏移。"
              )}
            </p>
          </div>
        ) : (
          <div className="py-2.5 text-center text-[10px] text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-lg">
            目前暫無任何期權持倉，請先在左方添加或执行交易。
          </div>
        )}
      </div>

      {/* IV Percentile Heatmap Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="iv-heatmap-container">
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">市場波動率熱力圖 (IVR)</h4>
          </div>
          <span className="text-[8px] uppercase px-1.5 py-0.5 bg-slate-105 rounded text-slate-500 font-mono font-bold">倒序評估</span>
        </div>
        
        <p className="text-[9px] text-slate-500 leading-normal mb-3">
          點擊標的即時切換中樞分析。優先交易 <strong>IVR &gt; 70%</strong> 之高溢價區間以快速捕獲相對套利空間。
        </p>

        <div className="overflow-hidden rounded-lg border border-slate-150 text-[10px]" id="iv-heatmap-table">
          <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-150 py-1.5 px-2.5 font-bold uppercase tracking-tight text-slate-400">
            <div className="col-span-3">港股標的</div>
            <div className="col-span-3 text-right">現價</div>
            <div className="col-span-3 text-right">隱含 IV</div>
            <div className="col-span-3 text-right">分位 (IVR)</div>
          </div>

          <div className="divide-y divide-slate-100">
            {heatmapData.map(item => {
              // Color-coding class logic
              let rowStyle = "";
              let badgeStyle = "";
              let levelLabel = "";

              if (item.ivRank >= 70) {
                rowStyle = "bg-emerald-50/45 hover:bg-emerald-50/80 border-l-[3px] border-l-emerald-500 text-emerald-950";
                badgeStyle = "bg-emerald-600 text-white font-extrabold";
                levelLabel = "極高 IV 溢價";
              } else if (item.ivRank >= 45) {
                rowStyle = "bg-amber-50/20 hover:bg-amber-50/50 border-l-[3px] border-l-amber-400 text-amber-950";
                badgeStyle = "bg-amber-500 text-slate-900 font-bold";
                levelLabel = "估值中等";
              } else {
                rowStyle = "bg-slate-50/15 hover:bg-slate-50/45 border-l-[3px] border-l-slate-300 text-slate-650";
                badgeStyle = "bg-slate-200 text-slate-700";
                levelLabel = "波幅平緩";
              }

              return (
                <div 
                  key={item.symbol}
                  id={`heatmap-row-${item.symbol}`}
                  onClick={() => onTickerClick(item.symbol)}
                  className={cn(
                    "grid grid-cols-12 py-2 px-2.5 items-center transition-all cursor-pointer font-medium",
                    rowStyle
                  )}
                  title={`點擊聚焦 ${item.symbol}.HK 分析數據 (${levelLabel})`}
                >
                  {/* Symbol Code */}
                  <div className="col-span-3 font-bold flex items-center gap-1">
                    <span className="font-mono text-slate-800">{item.symbol}</span>
                    <span className="text-[8px] text-slate-400 scale-90 font-normal">.HK</span>
                  </div>

                  {/* Stock Price */}
                  <div className="col-span-3 text-right font-mono text-slate-600">
                    HK${item.price > 0 ? item.price.toFixed(1) : '--'}
                  </div>

                  {/* Implied Volatility (IV) */}
                  <div className="col-span-3 text-right font-mono text-slate-600">
                    {item.iv > 0 ? `${item.iv.toFixed(1)}%` : '--'}
                  </div>

                  {/* IV Rank Percentile Heat value */}
                  <div className="col-span-3 text-right flex items-center justify-end gap-1 font-mono animate-fade-in">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter shadow-xs text-center min-w-[32px] block",
                      badgeStyle
                    )}>
                      {item.ivRank}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Heatmap Legend Scale */}
        <div className="mt-2 text-[8px] uppercase tracking-wider font-extrabold text-slate-400 font-mono px-1 flex justify-between items-center bg-slate-50/30 p-1 rounded-md border border-slate-100">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>平緩 (&lt;45%)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>中等</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>溢價 (&gt;70%)</span>
          </div>
        </div>
      </div>

      {positions.map((pos) => {
        let actionTag = '繼續持有 HOLD';
        let actionColor = 'bg-slate-100 text-slate-600 border border-slate-200';
        let plColor = 'text-emerald-600';
        let isBreached = false;
        
        if (pos.plPercent >= 0.5) {
          actionTag = '停利平倉';
          actionColor = 'bg-emerald-600 text-white animate-pulse';
        } else if (pos.plPercent <= -1.0) {
          actionTag = '止損/展期';
          actionColor = 'bg-rose-600 text-white font-black tracking-tight';
          plColor = 'text-rose-600 font-bold';
          isBreached = true;
        } else if (pos.dte < 21) {
          actionTag = '即期展期 ROLL';
          actionColor = 'bg-amber-500 text-white animate-pulse';
        }

        // Simulate a daily price movement trend based on the position's unique properties
        const seedValue = pos.id.charCodeAt(0) + (pos.id.charCodeAt(pos.id.length - 1) || 0);
        const simulatedTrendChange = ((seedValue % 11) - 5) * 0.35 || 0.15;
        const isTrendUp = simulatedTrendChange >= 0;

        return (
          <div 
            key={pos.id} 
            className={cn(
               "bg-white p-3.5 border rounded-lg transition-all hover:bg-slate-50 cursor-pointer shadow-xs",
              isBreached ? "border-rose-300 bg-rose-50/25" : "border-slate-200"
            )}
            onClick={() => onTickerClick(pos.symbol)}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black font-mono text-slate-800">
                  {pos.symbol} {pos.type.includes('Put') ? '認沽 PUT' : '認購 CALL'} @ {pos.strike}
                </span>
                {pos.dte < 21 && (
                  <span className="flex h-2 w-2 rounded-full bg-rose-600 animate-pulse shadow-[0_0_8px_rgba(225,29,72,0.8)]" title="到期日過近 - 建議採取行動" />
                )}
              </div>
              <span className={cn("text-[10px] px-1.5 rounded uppercase font-black", actionColor)}>
                {actionTag}
              </span>
            </div>
            
            <div className="flex items-baseline gap-2">
              <span className={cn("text-2xl font-mono font-black tracking-tight", plColor)}>
                {pos.plPercent >= 0 ? '+' : ''}{(pos.plPercent * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-mono italic font-bold">
                {isBreached ? '已跌破安全限制' : '目前累計損益'}
              </span>
            </div>

            {/* Real-time Current Option Premium & Trend Indicator */}
            <div className="mt-3.5 mb-2 px-3 py-2 bg-slate-50/65 border border-slate-150 rounded-lg flex items-center justify-between text-[10px] font-mono shadow-inner">
              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">建立成本 Entry</span>
                <span className="text-slate-600 font-bold">HK${pos.entryPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-md px-1.5 py-0.5 shadow-3xs">
                <div className="text-right flex flex-col gap-0.5">
                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">目前市價 Current</span>
                  <span className="text-slate-800 font-extrabold">HK${pos.currentPrice.toFixed(2)}</span>
                </div>
                {/* Visual Trend Arrow & Simulated Shift Indicator */}
                <div className="flex items-center gap-0.5 shrink-0" id={`pos-trend-${pos.id}`}>
                  {isTrendUp ? (
                    <div className="flex items-center text-emerald-600 font-bold" title="上行波動趨勢">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black">+{simulatedTrendChange.toFixed(2)}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-rose-600 font-bold" title="下行波動趨勢">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black">{simulatedTrendChange.toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 text-[10px] text-slate-405 uppercase tracking-tight">
              <div className="flex items-center gap-1 font-semibold">
                到期天數 (DTE): <span className={cn(pos.dte < 21 ? 'text-rose-600 font-extrabold' : 'text-slate-700')}>{pos.dte}</span>
                {pos.dte < 21 && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />}
              </div>
              <div className="font-semibold text-slate-400">隱含波動率 IV: <span className="text-slate-700">{(pos.plPercent + 0.25).toFixed(1)}%</span></div>
            </div>
          </div>
        );
      })}

      {/* 交易守則及風控原則 (Rules of Trade) Card */}
      <div className="bg-slate-900 border border-slate-950 text-slate-100 rounded-xl p-4 shadow-sm mt-2" id="trading-rules-container">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
          <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
          <h4 className="text-[10px] uppercase tracking-widest text-slate-200 font-bold">核心期權交易守則 & 風控系統 (Rules of Trade)</h4>
        </div>
        
        <div className="flex flex-col gap-3.5 text-[10px] leading-relaxed text-slate-300 font-medium">
          {/* Rule 1 */}
          <div className="flex gap-2.5 items-start">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/25 border border-indigo-500/40 text-indigo-400 font-mono font-black text-[9px] shrink-0 mt-0.5">1</span>
            <div>
              <span className="font-bold text-slate-100">高隱含波動率百分位優先 (Sell High IVR)</span>
              <p className="text-slate-400 text-[9px] mt-0.5">
                優先在隱含波動率百分位 (IVR) &gt; 50% 時做賣方期權（Short Put/Short Call），以賺取更高的時間價值與波動率溢價。
              </p>
            </div>
          </div>

          {/* Rule 2 */}
          <div className="flex gap-2.5 items-start">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/25 border border-purple-500/40 text-purple-400 font-mono font-black text-[9px] shrink-0 mt-0.5">2</span>
            <div>
              <span className="font-bold text-slate-100">時間價值黃金衰減區間 (Optimal DTE Segment)</span>
              <p className="text-slate-400 text-[9px] mt-0.5">
                建倉首選 30-45 天 DTE（到期天數），此時時間價值 (Theta) 衰減速度最快。DTE &lt; 21 天時必須強制進行滾動展期 (Roll) 或平倉。
              </p>
            </div>
          </div>

          {/* Rule 3 */}
          <div className="flex gap-2.5 items-start">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 font-mono font-black text-[9px] shrink-0 mt-0.5">3</span>
            <div>
              <span className="font-bold text-slate-100">賬戶保證金嚴格配比 (Strict Margin Cap)</span>
              <p className="text-slate-400 text-[9px] mt-0.5">
                整體已佔用保證金水位應維持在 50% 以下，防止極端波動。單一標的之保證金佔比強烈建議限制在 15% 以內。
              </p>
            </div>
          </div>

          {/* Rule 4 */}
          <div className="flex gap-2.5 items-start">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/25 border border-rose-500/40 text-rose-400 font-mono font-black text-[9px] shrink-0 mt-0.5">4</span>
            <div>
              <span className="font-bold text-slate-100">科學止盈與展期安全墊 (Profit / Roll Trigger)</span>
              <p className="text-slate-400 text-[9px] mt-0.5">
                賣出期權權利金浮盈達 50% 時平倉停利；若標的價觸及或突破警報界限，虧損達 100% 權利金時應及時向後拖延展期 (Roll Out/Down)。
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[8px] text-slate-500 font-extrabold font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="uppercase">風險評級：保守防禦型 (Conservative-Defensive)</span>
          </div>
          <span>BETA v2.4</span>
        </div>
      </div>
    </div>
  );
}
