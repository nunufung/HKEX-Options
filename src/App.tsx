import { useState, useEffect, useRef } from 'react';
import { Activity, LayoutDashboard, Database, AlertCircle, RefreshCw, BarChart3, Newspaper } from 'lucide-react';
import DecisionCard from './components/DecisionCard';
import CandidatesTable from './components/CandidatesTable';
import PositionMonitor from './components/PositionMonitor';
import SentimentAnalysis from './components/SentimentAnalysis';
import TickerInput from './components/TickerInput';
import RiskConfig from './components/RiskConfig';
import AlertManager from './components/AlertManager';
import AnalysisCharts from './components/AnalysisCharts';
import StockInfoPanel from './components/StockInfoPanel';
import { OptionData, Position, DecisionResult, NewsItem, RiskWeights, DEFAULT_WEIGHTS, Alert, AlertSettings, DEFAULT_ALERT_SETTINGS, StockInfo } from './types';
import { evaluateOption, getHKTime, isMarketOpen, calculateDTE } from './DecisionEngine';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const [options, setOptions] = useState<OptionData[]>([]);
  const [weights, setWeights] = useState<RiskWeights>(DEFAULT_WEIGHTS);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string>('700');
  const [activeTab, setActiveTab] = useState<'analysis' | 'decision' | 'monitor'>('decision');
  const [watchedTickers, setWatchedTickers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('watched_tickers');
      return saved ? JSON.parse(saved) : ['700', '9988', '3690', '2800'];
    } catch (err) {
      console.error('Failed to parse watched tickers from localStorage:', err);
      return ['700', '9988', '3690', '2800'];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('watched_tickers', JSON.stringify(watchedTickers));
    } catch (err) {
      console.error('Failed to save watched tickers to localStorage:', err);
    }
  }, [watchedTickers]);

  const [positions, setPositions] = useState<Position[]>([
    { id: '1', symbol: 'HKEX', type: 'Short Put', strike: 310, expiry: '2026-06-25', dte: calculateDTE('2026-06-25'), entryPrice: 12.5, currentPrice: 5.6, plPercent: 0.55, margin: 5500 },
    { id: '2', symbol: 'Tencent', type: 'Short Call', strike: 450, expiry: '2026-06-12', dte: calculateDTE('2026-06-12'), entryPrice: 8.2, currentPrice: 17.5, plPercent: -1.13, margin: 8200 },
    { id: '3', symbol: 'Alibaba', type: 'Short Put', strike: 80, expiry: '2026-06-30', dte: calculateDTE('2026-06-30'), entryPrice: 4.5, currentPrice: 3.6, plPercent: 0.20, margin: 4500 },
  ]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [currentTime, setCurrentTime] = useState(getHKTime());
  const [mainDecision, setMainDecision] = useState<DecisionResult>({
    action: '等待',
    reason: '請導入數據進行評估',
    score: 0,
    color: 'yellow'
  });
  const [bestOption, setBestOption] = useState<OptionData | undefined>(undefined);

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [isStockInfoLoading, setIsStockInfoLoading] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const lastPrices = useRef<Record<string, number>>({});

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onopen = () => setWsStatus('connected');
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'OPTION_UPDATE') {
          setOptions(prev => {
            let changed = false;
            const next = prev.map(opt => {
              if (opt.symbol === data.symbol) {
                changed = true;
                return {
                  ...opt,
                  bid: parseFloat(data.bid),
                  ask: parseFloat(data.ask),
                  last: parseFloat(data.last),
                  iv: parseFloat(data.iv),
                  ivRank: data.ivRank,
                  delta: parseFloat(data.delta),
                  underlyingPrice: opt.underlyingPrice || parseFloat(data.underlyingPrice || '100'),
                  dte: calculateDTE(opt.expiry)
                };
              }
              return opt;
            });
            return changed ? next : prev;
          });
          setLastUpdated(new Date());
        }

        if (data.type === 'POSITION_UPDATE') {
          setPositions(prev => prev.map(pos => {
            if (pos.id === data.id) {
              const newPrice = parseFloat(data.newPrice);
              // Calculate P/L based on entry price vs current price (assuming short for mock)
              const plPercent = (pos.entryPrice - newPrice) / pos.entryPrice;
              return {
                ...pos,
                currentPrice: newPrice,
                plPercent
              };
            }
            return pos;
          }));
        }
      } catch (err) {
        console.error('WS Message parsing error:', err);
      }
    };
    socket.onclose = () => setWsStatus('disconnected');
    socket.onerror = () => setWsStatus('disconnected');

    return () => socket.close();
  }, []);

  const addAlert = (type: Alert['type'], message: string) => {
    setAlerts(prev => {
      const isDuplicate = prev.slice(-5).some(a => a.message === message && (new Date().getTime() - a.timestamp.getTime()) < 60000);
      if (isDuplicate) return prev;
      
      return [...prev, {
        id: Math.random().toString(36).substring(7),
        type,
        message,
        timestamp: new Date(),
        read: false
      }].slice(-50);
    });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getHKTime());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchNews = () => {
      fetch('/api/news')
        .then(res => res.json())
        .then(data => setNews(data))
        .catch(err => console.error('News fetch error:', err));
    };

    const fetchOptions = () => {
      const tickerQuery = watchedTickers.join(',');
      fetch(`/api/options-chain?tickers=${tickerQuery}`)
        .then(res => res.json())
        .then((data: OptionData[]) => {
          const processed = data.map(opt => ({
            ...opt,
            dte: calculateDTE(opt.expiry)
          }));
          setOptions(processed);
          setLastUpdated(new Date());
        })
        .catch(err => console.error('Options fetch error:', err));
    };

    fetchNews();
    fetchOptions();

    const refreshTimer = setInterval(() => {
      fetchNews();
      fetchOptions();
    }, 15000); // Refresh every 15 seconds

    return () => clearInterval(refreshTimer);
  }, [watchedTickers]);

  // Recalculate decisions when options or weights change
  useEffect(() => {
    if (options.length === 0) return;

    const evalResults = options.map(o => evaluateOption(o, weights));
    const paired = options.map((o, idx) => ({ option: o, result: evalResults[idx] }));
    const sorted = [...paired].sort((a, b) => b.result.score - a.result.score);
    
    if (sorted.length > 0) {
      setMainDecision(sorted[0].result);
      setBestOption(sorted[0].option);
      
      // Alert logic for high opportunity based on score AND specific thresholds
      options.forEach((o, index) => {
        const res = evalResults[index];
        const meetsThresholds = 
          res.action === '做' && 
          res.score >= alertSettings.minScore &&
          o.iv >= alertSettings.minIV &&
          o.ivRank >= alertSettings.minIVRank &&
          Math.abs(o.delta) <= alertSettings.maxDelta;

        if (meetsThresholds) {
          addAlert('success', `高價值機會：${o.symbol} (評分: ${res.score}, IV: ${(o.iv * 100).toFixed(1)}%, 波動分位 IVR: ${o.ivRank}, Delta: ${o.delta.toFixed(2)})`);
        }
      });
    }
  }, [options, weights, alertSettings]);

  useEffect(() => {
    if (!selectedTicker) return;
    
    const fetchStockInfo = async () => {
      setIsStockInfoLoading(true);
      try {
        const res = await fetch(`/api/stock-info/${selectedTicker}`);
        const data = await res.json();
        setStockInfo(data);
      } catch (err) {
        console.error('Stock info fetch error:', err);
      } finally {
        setIsStockInfoLoading(false);
      }
    };

    fetchStockInfo();

    const stockRefreshTimer = setInterval(fetchStockInfo, 15000); // Refresh every 15 seconds
    return () => clearInterval(stockRefreshTimer);
  }, [selectedTicker]);

  useEffect(() => {
    if (!stockInfo || !selectedTicker) return;

    const prevPrice = lastPrices.current[selectedTicker];
    const currentPrice = stockInfo.price;

    if (prevPrice && currentPrice !== prevPrice) {
      const percentChange = Math.abs((currentPrice - prevPrice) / prevPrice);
      
      // Percent move alert
      if (percentChange >= alertSettings.priceChangeThreshold) {
        addAlert('warning', `大幅波動提示：${selectedTicker}.HK 價格變動了 ${(percentChange * 100).toFixed(1)}%，目前價格為 $${currentPrice}`);
      }

      // Price crossing threshold alert
      if (alertSettings.priceTargetAlert > 0) {
        const target = alertSettings.priceTargetAlert;
        const crossedUp = prevPrice < target && currentPrice >= target;
        const crossedDown = prevPrice > target && currentPrice <= target;
        
        if (crossedUp) {
          addAlert('success', `價格觸達提醒：${selectedTicker}.HK 向上突破目標價 $${target}`);
        } else if (crossedDown) {
          addAlert('danger', `價格觸達提醒：${selectedTicker}.HK 向下調破目標價 $${target}`);
        }
      }
    }

    lastPrices.current[selectedTicker] = currentPrice;
  }, [stockInfo, selectedTicker, alertSettings.priceChangeThreshold, alertSettings.priceTargetAlert]);

  useEffect(() => {
    positions.forEach(pos => {
      if (pos.plPercent >= alertSettings.profitTarget) {
        addAlert('success', `停利提醒：${pos.symbol} 倉位已達到停利目標 ${(pos.plPercent * 100).toFixed(0)}%`);
      } else if (pos.plPercent <= alertSettings.lossLimit) {
        addAlert('danger', `止損警告：${pos.symbol} 倉位回撤跌破限制 ${(pos.plPercent * 100).toFixed(0)}%`);
      } else if (pos.dte < alertSettings.dteThreshold) {
        addAlert('warning', `到期日警告：${pos.symbol} 僅剩餘 ${pos.dte} 天 DTE 到期`);
      }
    });
  }, [positions, alertSettings]);



  return (
    <div className="flex flex-col h-screen w-full bg-[#f8fafc] text-slate-800 overflow-hidden font-sans border border-slate-200 shadow-sm">
      {/* Header Navigation */}
      <header className="flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-6 py-3 md:py-4 border-b border-slate-200 bg-white gap-3 shadow-sm z-10">
        <div className="flex items-center justify-between md:justify-start gap-4 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center font-bold text-white shadow-sm">H</div>
            <h1 className="text-sm sm:text-md font-bold tracking-tight text-slate-900">
              港交所期權 <span className="text-emerald-600">決策分析引擎</span>
            </h1>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 md:gap-8 w-full md:w-auto">
          <div className="flex flex-col items-start md:items-end">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">香港市場時間 (HKT)</span>
            <span className="text-sm sm:text-lg font-mono font-bold text-slate-800 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded shadow-inner">
              {currentTime.toLocaleTimeString('en-HK', { hour12: true })}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] sm:text-xs flex items-center gap-1.5 shadow-sm">
              <RefreshCw className={cn("w-3 h-3 text-emerald-600", wsStatus === 'connected' && 'animate-spin-slow')} />
              <span className="text-[9px] text-slate-600 font-bold uppercase">
                {wsStatus === 'connected' ? '實時數據傳輸中' : '數據已更新'}: {lastUpdated.toLocaleTimeString()}
              </span>
            </div>
            
            <div className={cn(
              "px-2.5 py-1 border rounded text-[9px] uppercase font-extrabold tracking-tight transition-all flex items-center justify-center shadow-sm",
              wsStatus === 'connected' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
              wsStatus === 'connecting' ? 'bg-amber-50 border-amber-200 text-amber-700' :
              'bg-rose-50 border-rose-200 text-rose-700'
            )}>
              {wsStatus === 'connected' ? '在線連線' : 
               wsStatus === 'connecting' ? '初始化中' : 
               '非連線狀態'}
            </div>

            {isMarketOpen() ? (
              <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-[9px] flex items-center gap-1.5 shadow-sm">
                <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                <span className="font-extrabold uppercase tracking-wider text-[10px]">已開市</span>
              </div>
            ) : (
              <div className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-800 rounded text-[9px] flex items-center gap-1.5 shadow-sm">
                <div className="w-1.5 h-1.5 bg-rose-600 rounded-full" />
                <span className="font-extrabold uppercase tracking-wider text-[10px]">已收市</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Tab Control Rail */}
      <nav className="flex lg:hidden bg-white border-b border-slate-200 px-1 py-0.5 select-none z-10 sticky top-0 shrink-0 shadow-sm">
        <button
          onClick={() => setActiveTab('analysis')}
          className={cn(
            "flex-1 py-2 text-center transition-all flex flex-col items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider border-b-2",
            activeTab === 'analysis' 
              ? "text-emerald-600 border-emerald-600 bg-emerald-50/20" 
              : "text-slate-400 border-transparent hover:text-slate-600"
          )}
        >
          <Newspaper className="w-4 h-4" />
          <span>資訊與設定</span>
        </button>
        <button
          onClick={() => setActiveTab('decision')}
          className={cn(
            "flex-1 py-2 text-center transition-all flex flex-col items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider border-b-2",
            activeTab === 'decision' 
              ? "text-emerald-600 border-emerald-600 bg-emerald-50/20" 
              : "text-slate-400 border-transparent hover:text-slate-600"
          )}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>核心決策中樞</span>
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          className={cn(
            "flex-1 py-2 text-center transition-all flex flex-col items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider border-b-2",
            activeTab === 'monitor' 
              ? "text-emerald-600 border-emerald-600 bg-emerald-50/20" 
              : "text-slate-400 border-transparent hover:text-slate-600"
          )}
        >
          <BarChart3 className="w-4 h-4" />
          <span>投資組合監控</span>
        </button>
      </nav>

      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-px bg-slate-200 overflow-hidden relative">
        {/* LEFT COLUMN: News, Alerts & Sentiment - Balanced at col-span-4 */}
        <aside className={cn(
          "bg-white p-4 gap-6 overflow-y-auto custom-scrollbar transition-all duration-300 border-r border-slate-200 shadow-xs",
          activeTab === 'analysis' ? 'flex flex-col flex-1 h-full' : 'hidden',
          "lg:flex lg:flex-col lg:col-span-4 lg:h-auto"
        )}>
          <TickerInput 
            onAdd={(t) => {
              if (!watchedTickers.includes(t)) {
                setWatchedTickers([...watchedTickers, t]);
              }
              setSelectedTicker(t);
            }} 
            watchedTickers={watchedTickers}
            onRemove={(t) => {
              setWatchedTickers(watchedTickers.filter(ticker => ticker !== t));
              if (selectedTicker === t && watchedTickers.length > 1) {
                setSelectedTicker(watchedTickers.find(ticker => ticker !== t) || '');
              }
            }}
            onSelect={setSelectedTicker}
            selectedTicker={selectedTicker}
          />

          <RiskConfig weights={weights} onChange={setWeights} />

          <SentimentAnalysis 
            currentTicker={selectedTicker} 
            news={news} 
            onAddToMonitor={(t) => {
              if (!watchedTickers.includes(t)) {
                setWatchedTickers([...watchedTickers, t]);
                addAlert('success', `已將標的 ${t} 加入自選觀察名單`);
              }
            }}
            isCustomMonitored={(t) => watchedTickers.includes(t)}
          />

          {/* Integrated Alert Trigger Manager */}
          <AlertManager 
            alerts={alerts}
            settings={alertSettings}
            onUpdateSettings={setAlertSettings}
            onClearAlerts={() => setAlerts([])}
            onMarkAsRead={(id) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))}
          />
          
          <h2 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-100 pb-2">實時金融新聞動態</h2>
          <div className="flex flex-col gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
            {news.map(item => (
              <div key={item.id} className={cn(
                "p-3 bg-slate-50 border-l-2 border-y border-r border-slate-100/80 transition-all hover:bg-slate-100/50 rounded shadow-xs",
                item.sentiment === 'positive' ? 'border-l-emerald-500' : 
                item.sentiment === 'caution' ? 'border-l-amber-500' :
                item.sentiment === 'negative' ? 'border-l-rose-500' : 'border-l-slate-300'
              )}>
                <span className="text-[10px] text-slate-400 block font-medium mb-1">{item.date || '10:14 AM'}</span>
                <p className="text-xs font-semibold text-slate-800 leading-snug">{item.title}</p>
              </div>
            ))}
          </div>
          
          {/* Integrated Risk Control & Volatility Warnings stacked beautifully */}
          <div className="mt-auto pt-4 border-t border-slate-100 space-y-3.5">
            <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-lg">
              <h3 className="text-xs font-bold uppercase text-slate-400 mb-3 flex items-center justify-between">
                <span>當前整體風險評級</span>
                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 font-black">MEDIUM RISK</span>
              </h3>
              <div className="flex gap-1 h-2">
                <div className="flex-1 bg-emerald-500 rounded-sm"></div>
                <div className="flex-1 bg-emerald-500 rounded-sm"></div>
                <div className="flex-1 bg-amber-500 rounded-sm"></div>
                <div className="flex-1 bg-slate-200 rounded-sm"></div>
                <div className="flex-1 bg-slate-200 rounded-sm"></div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 uppercase font-extrabold tracking-tight leading-snug">中等風險：雖然當前隱含波動率 (IV) 溢價較高，但臨近財報公佈日，建議控制整體曝險比例。</p>
            </div>

            {/* Global Market Volatility Alert - Nesting here for high colorful visual balance */}
            <div className="p-3 bg-gradient-to-br from-rose-50/70 to-red-50/40 border border-rose-150 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                <p className="text-[10px] font-extrabold text-rose-700 uppercase tracking-tight leading-none">全球市場波動預警</p>
              </div>
              <p className="text-[9.5px] text-slate-600 leading-normal">
                恒指波幅指數 (VHSI) 急漲 4%。強烈建議針對高貝塔值科技股認沽期權（Short Put）收緊止損防禦位置。
              </p>
            </div>
          </div>
        </aside>

        {/* CENTER / MIDDLE COLUMN: Dynamic Analytical Dashboard - Expanded at col-span-8 */}
        <div className={cn(
          "bg-slate-50 p-4 sm:p-6 gap-8 overflow-y-auto custom-scrollbar transition-all duration-300",
          activeTab === 'decision' ? 'flex flex-col flex-1 h-full' : 'hidden',
          "lg:flex lg:flex-col lg:col-span-8 lg:h-auto"
        )}>
          <AnimatePresence mode="wait">
            <div key="dashboard-main" className="space-y-8">
              {/* Modern Analytical Ticker Dashboard - Balanced & Space-Efficient Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5" id="center-ticker-dashboard">
                <div className="md:col-span-5 flex flex-col">
                  <StockInfoPanel info={stockInfo} loading={isStockInfoLoading} />
                </div>
                <div className="md:col-span-7 flex flex-col">
                  <AnalysisCharts ticker={selectedTicker} />
                </div>
              </div>

              {/* Dynamic Option Evaluator */}
              <DecisionCard 
                decision={mainDecision} 
                bestOption={bestOption}
                onExecute={(opt) => {
                  const newPosition: Position = {
                    id: Math.random().toString(36).substring(7),
                    symbol: opt.symbol,
                    type: opt.type as any,
                    strike: opt.strike,
                    expiry: opt.expiry,
                    dte: calculateDTE(opt.expiry),
                    entryPrice: opt.premium,
                    currentPrice: opt.premium,
                    plPercent: 0,
                    margin: opt.premium * 100 * 0.15 // Rough margin estimate
                  };
                  
                  setPositions(prev => [newPosition, ...prev]);
                  addAlert('success', `交易成功執行：成功賣出 ${opt.symbol} ${opt.type === 'Put' ? '認沽 PUT' : '認購 CALL'} @ ${opt.strike} 權利金：$${opt.premium.toFixed(2)}`);
                }}
              />

              {/* Integrated Position Monitor - Nested in the flow on desktop, extremely trendy! */}
              <div className="hidden lg:block space-y-4" id="desktop-position-monitor-wrapper">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-600 block" />
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">個股盤析與持倉監控 (Portfolio Positions & Rules)</h3>
                </div>
                <PositionMonitor 
                  positions={positions} 
                  onTickerClick={setSelectedTicker} 
                  watchedTickers={watchedTickers}
                  options={options}
                />
              </div>
              
              <div className="space-y-8">
                <CandidatesTable 
                  options={options} 
                  weights={weights} 
                  onTickerClick={setSelectedTicker} 
                  />
              </div>
            </div>
          </AnimatePresence>
        </div>

        {/* MOBILE ONLY RAIL: Position Monitor (Hidden on desktop since it is beautifully nested in Center Column) */}
        <aside className={cn(
          "bg-white p-4 border-slate-200 transition-all duration-300 shadow-xs",
          activeTab === 'monitor' ? 'flex flex-col flex-1 h-full overflow-y-auto border-t sm:border-t-0' : 'hidden',
          "lg:hidden"
        )}>
          <h2 className="text-[10px] uppercase tracking-widest text-[#64748b] font-black border-b border-slate-100 pb-2 mb-4">
            個股盤析與持倉監控 (Mobile Tab)
          </h2>
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar h-full">
            <PositionMonitor 
              positions={positions} 
              onTickerClick={setSelectedTicker} 
              watchedTickers={watchedTickers}
              options={options}
            />
          </div>
        </aside>
      </main>

      {/* Footer Status Bar */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2 flex flex-col sm:flex-row gap-2 justify-between items-center text-[9px] sm:text-[10px] text-slate-500 font-mono shrink-0 shadow-xs">
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center sm:justify-start">
          <span>系統版本: 1.0.4-BETA</span>
          <span className="text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse"></span>
            實時數據連接正常
          </span>
          <span>量化規則引擎：運行中</span>
        </div>
        <div className="flex gap-4 uppercase justify-center sm:justify-end">
          <span>數據訂閱動態：活躍中</span>
          <span>單日可用額度: 25.0M</span>
        </div>
      </footer>
    </div>
  );
}
