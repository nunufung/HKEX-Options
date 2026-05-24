import { useState } from 'react';
import { TrendingUp, AlertTriangle, Clock, ShieldCheck, ArrowRight, HelpCircle, Loader2, Download } from 'lucide-react';
import { DecisionResult, OptionData } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDTE } from '../DecisionEngine';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface DecisionCardProps {
  decision: DecisionResult;
  bestOption?: OptionData;
  onExecute?: (option: OptionData) => void;
}

const METRIC_DESCRIPTIONS: Record<string, string> = {
  'DTE Decay': '時間價值衰減對期權價值的影響。得分越高，代表 Theta 與風險比率越佳。',
  'Spread Qual': '買賣價差品質。得分越高，代表流動性越好，進出場執行價格更優。',
  'Efficiency': '資金回報效率（期權金相較於占用保證金）。得分越高，代表預期資金回報率越佳。',
  'Vol Opp': '波動率套利空間（隱含波動率與歷史原波動率比較）。得分越高，代表期權估值高估，適合做賣方。',
  'IV Rank': '隱含波動率的相對歷史水準。得分越高，代表目前隱含波動率明顯高於其本身歷史區間。',
  'Delta Risk': '方向性風險敞口控制。得分越高，代表 Delta 處於理想的安全或中性區間。',
  'Liquidity': '市場交易量與未平倉合約。得分越高，代表日常交易活躍、買賣價滑價損失越低。',
  'Safety': '經風險調整後的整體安全邊際，考量執行價與正股現價的防禦距離。',
};

const LABEL_MAP: Record<string, string> = {
  'DTE Decay': '時間波動衰減',
  'Spread Qual': '買賣價差品質',
  'Efficiency': '資金使用效率',
  'Vol Opp': '波動率套利空間',
  'IV Rank': '波動率百分位',
  'Delta Risk': 'Delta 風險控制',
  'Liquidity': '市場流動性',
  'Safety': '安全性邊際',
};

const METRIC_THEMES: Record<string, {
  border: string;
  borderHover: string;
  bg: string;
  text: string;
  badgeBg: string;
  progressBg: string;
  glow: string;
}> = {
  'DTE Decay': {
    border: 'border-emerald-200/80',
    borderHover: 'hover:border-emerald-400 hover:shadow-emerald-100/40',
    bg: 'bg-emerald-50/50',
    text: 'text-emerald-700',
    badgeBg: 'bg-emerald-100/70',
    progressBg: 'bg-gradient-to-r from-emerald-400 to-teal-500',
    glow: 'shadow-xs hover:shadow-md'
  },
  'Spread Qual': {
    border: 'border-indigo-200/80',
    borderHover: 'hover:border-indigo-400 hover:shadow-indigo-100/40',
    bg: 'bg-indigo-50/50',
    text: 'text-indigo-700',
    badgeBg: 'bg-indigo-100/70',
    progressBg: 'bg-gradient-to-r from-indigo-400 to-violet-500',
    glow: 'shadow-xs hover:shadow-md'
  },
  'Efficiency': {
    border: 'border-purple-200/80',
    borderHover: 'hover:border-purple-400 hover:shadow-purple-100/40',
    bg: 'bg-purple-50/50',
    text: 'text-purple-700',
    badgeBg: 'bg-purple-100/70',
    progressBg: 'bg-gradient-to-r from-purple-400 to-fuchsia-500',
    glow: 'shadow-xs hover:shadow-md'
  },
  'Vol Opp': {
    border: 'border-pink-200/80',
    borderHover: 'hover:border-pink-400 hover:shadow-pink-100/40',
    bg: 'bg-pink-50/50',
    text: 'text-pink-700',
    badgeBg: 'bg-pink-100/70',
    progressBg: 'bg-gradient-to-r from-pink-400 to-rose-500',
    glow: 'shadow-xs hover:shadow-md'
  },
  'IV Rank': {
    border: 'border-rose-200/80',
    borderHover: 'hover:border-rose-400 hover:shadow-rose-100/40',
    bg: 'bg-rose-50/50',
    text: 'text-rose-700',
    badgeBg: 'bg-rose-100/70',
    progressBg: 'bg-gradient-to-r from-rose-400 to-red-550',
    glow: 'shadow-xs hover:shadow-md'
  },
  'Delta Risk': {
    border: 'border-sky-200/80',
    borderHover: 'hover:border-sky-400 hover:shadow-sky-100/40',
    bg: 'bg-sky-50/50',
    text: 'text-sky-700',
    badgeBg: 'bg-sky-100/70',
    progressBg: 'bg-gradient-to-r from-sky-400 to-blue-500',
    glow: 'shadow-xs hover:shadow-md'
  },
  'Liquidity': {
    border: 'border-teal-200/80',
    borderHover: 'hover:border-teal-400 hover:shadow-teal-100/40',
    bg: 'bg-teal-50/50',
    text: 'text-teal-700',
    badgeBg: 'bg-indigo-100/70',
    progressBg: 'bg-gradient-to-r from-teal-400 to-emerald-500',
    glow: 'shadow-xs hover:shadow-md'
  },
  'Safety': {
    border: 'border-amber-200/80',
    borderHover: 'hover:border-amber-400 hover:shadow-amber-100/40',
    bg: 'bg-amber-50/50',
    text: 'text-amber-700',
    badgeBg: 'bg-amber-100/70',
    progressBg: 'bg-gradient-to-r from-amber-400 to-orange-500',
    glow: 'shadow-xs hover:shadow-md'
  }
};

export default function DecisionCard({ decision, bestOption, onExecute }: DecisionCardProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const metrics = decision.metrics;

  const primaryDrivers: string[] = [];
  const limitingFactors: string[] = [];

  if (metrics) {
    if (metrics.dteScore >= 70) primaryDrivers.push('時間時間衰減優勢');
    else if (metrics.dteScore < 50) limitingFactors.push('到期到期天數 (DTE) 區間欠佳');

    if (metrics.spreadScore >= 70) primaryDrivers.push('買賣利差細窄');
    else if (metrics.spreadScore < 50) limitingFactors.push('買賣利差過寬 (滑點摩擦風險偏高)');

    if (metrics.marginScore >= 70) primaryDrivers.push('資金回報倍率極佳');
    else if (metrics.marginScore < 50) limitingFactors.push('回報率相較保證金效率太低');

    if (metrics.ivScore >= 70) primaryDrivers.push('隱含波動率 (IV) 溢價高');
    else if (metrics.ivScore < 50) limitingFactors.push('隱含波動率低 (未提供足額溢價補償)');

    if (metrics.ivRankScore >= 70) primaryDrivers.push('歷史波動分位 (IVR) 處於高檔值');
    else if (metrics.ivRankScore <= 40) limitingFactors.push('IV Rank 歷史水位偏低');

    if (metrics.deltaScore >= 70) primaryDrivers.push('Delta 敞口風險安全合理');
    else if (metrics.deltaScore < 50) limitingFactors.push('Delta 對沖敞口偏深 (易受單向穿擊)');

    if (metrics.liquidityScore >= 70) primaryDrivers.push('合約市場買賣流動量好');
    else if (metrics.liquidityScore < 50) limitingFactors.push('合約未平倉與深度交易微弱');

    if (metrics.safetyScore >= 70) primaryDrivers.push('與正股現價防禦距離安全');
    else if (metrics.safetyScore < 40) limitingFactors.push('行權價過接近現價 (行權威脅高)');
  }

  if (primaryDrivers.length === 0) primaryDrivers.push('各項量化指標平緩均衡');
  if (limitingFactors.length === 0) limitingFactors.push('期權溢價及時間參數未在極優交易區間');

  const primary = primaryDrivers.slice(0, 3).join('、');
  const limiting = limitingFactors.slice(0, 3).join('、');

  const handleDownloadPDF = async () => {
    setIsExportingPDF(true);
    try {
      // Create off-screen render container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '790px';
      container.style.backgroundColor = '#f8fafc'; // slate-50 background
      container.style.color = '#1e293b'; // slate-800
      container.style.padding = '35px';
      container.style.borderRadius = '12px';
      container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      
      const scoreColor = decision.score >= 70 ? '#10b981' : decision.score >= 40 ? '#f59e0b' : '#ef4444';
      const scoreBg = decision.score >= 70 ? '#ecfdf5' : decision.score >= 40 ? '#fffbeb' : '#fef2f2';
      const actionText = decision.action === '做' ? '推薦執行交易 (RECOMMEND)' : decision.action === '不做' ? '不建議操作 (HOLD)' : decision.action;
      const actionThemeColor = decision.action === '做' ? '#10b981' : decision.action === '不做' ? '#ef4444' : '#f59e0b';

      // Build premium HTML structure for the PDF compilation
      container.innerHTML = `
        <!-- Header Banner Section -->
        <div style="background-color: #0f172a; padding: 24px; border-radius: 8px; color: white; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; border-left: 6px solid #4f46e5;">
          <div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #f1f5f9;">OPTION QUANT INTELLIGENCE REPORT</h1>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">期權量化策略決策分析報告</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #cbd5e1; font-weight: 700;">系統計算時間 / TIMESTAMP</div>
            <div style="font-size: 12px; color: #38bdf8; font-family: monospace; font-weight: 700; margin-top: 2px;">
              ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
            </div>
          </div>
        </div>

        <!-- Two Column Main Metadata & Score Grid -->
        <div style="display: grid; grid-template-columns: 2fr 130px; gap: 20px; margin-bottom: 24px;">
          <!-- Left Info Card -->
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="font-size: 9px; text-transform: uppercase; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 4px;">今日決策結論 / DECISION CONCLUSION</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${actionThemeColor};"></span>
              <h2 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">${actionText}</h2>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 12px;">
              <div>
                <span style="font-size: 9px; color: #64748b; font-weight: 700; display: block; margin-bottom: 2px;">推薦交易合約 / OPTION CONTRACT</span>
                <span style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">
                  ${bestOption ? `${bestOption.symbol} ${bestOption.type === 'Put' ? '認沽 PUT' : '認購 CALL'}` : 'N/A'}
                </span>
              </div>
              <div>
                <span style="font-size: 9px; color: #64748b; font-weight: 700; display: block; margin-bottom: 2px;">合約行權價格 / STRIKE PRICE</span>
                <span style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">
                  ${bestOption ? `$${bestOption.strike}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <!-- Right Score Circle Card -->
          <div style="background-color: ${scoreBg}; border: 2px solid ${scoreColor}; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px;">
            <span style="font-size: 10px; font-weight: 800; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">綜合評分</span>
            <div style="font-size: 38px; font-weight: 900; color: ${scoreColor}; font-family: monospace; line-height: 1;">${decision.score}</div>
            <span style="font-size: 8px; font-weight: 850; color: ${scoreColor}; background: white; border: 1px solid ${scoreColor}22; padding: 2px 6px; border-radius: 4px; margin-top: 6px; text-transform: uppercase;">
              ${decision.score >= 80 ? 'EXCELLENT' : decision.score >= 60 ? 'PASS' : 'HOLD'}
            </span>
          </div>
        </div>

        <!-- Option Details Section (Only if bestOption exists) -->
        ${bestOption ? `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02)">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #4f46e5; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            🎯 具體合約選取與操作建議 / SUGGESTION DETAIL
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; font-family: monospace; font-size: 11px;">
            <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <div style="font-size: 8px; color: #64748b; font-weight: 700; margin-bottom: 4px; font-family: sans-serif;">到期天數 / DTE RANGE</div>
              <div style="font-weight: 800; color: #0f172a;">${calculateDTE(bestOption.expiry)} Days (${bestOption.expiry})</div>
            </div>
            <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <div style="font-size: 8px; color: #64748b; font-weight: 700; margin-bottom: 4px; font-family: sans-serif;">預收期權金 / EST. PREMIUM</div>
              <div style="font-weight: 800; color: #10b981;">$${bestOption.premium.toFixed(2)}</div>
            </div>
            <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <div style="font-size: 8px; color: #64748b; font-weight: 700; margin-bottom: 4px; font-family: sans-serif;">佔用保證金 / MIN MARGIN</div>
              <div style="font-weight: 800; color: #0f172a;">$${bestOption.margin ? bestOption.margin.toFixed(0) : 'N/A'}</div>
            </div>
            <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <div style="font-size: 8px; color: #64748b; font-weight: 700; margin-bottom: 4px; font-family: sans-serif;">保證金報酬比 / RETURN RATIO</div>
              <div style="font-weight: 800; color: #4f46e5;">${bestOption.margin ? (bestOption.premium * 100 / bestOption.margin).toFixed(1) : 'N/A'}%</div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Decision Rationale Commentary -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #64748b;">
          <h3 style="margin: 0 0 10px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #334155; font-family: sans-serif; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
            📝 決策要旨及核心成因分析 / DECISION RATIONALE
          </h3>
          <p style="margin: 0; font-size: 11px; line-height: 1.7; color: #475569; text-align: justify; font-weight: 500;">
            ${decision.action === '做' ? 
              `系統強烈推薦執行此交易操作。主要原因為本期權合約具有<strong>【${primary}】</strong>等顯著量化指標上的多重優勢。在當前高波動率環境下，賣出此合約能最大份額地獲取期權時間價值 Theta 面向到期日的陡峭衰減；同時與標的正股現價保有高達 <strong>${bestOption?.safetyDistance ? (bestOption.safetyDistance * 100).toFixed(1) : '8.5'}%</strong> 的行權安全垫，下行防禦距離十分寬闊、行權穿擊機率極低。` :
              `系統當前不建議在此自選中樞上建立新的開倉倉位。主要受制因子為：【<strong>${decision.reason.replace(/DTE < 14/g, '到期天數過短，極易遭受高 Gamma 尾部擠壓').replace(/Spread 過闊/g, '買賣滑定價差過寬，面臨摩擦損失阻礙').replace(/Margin \/ Premium > 60x/g, '保證金與期權溢價偏低，資金佔用回報效率底').replace(/Delta > 0.45/g, 'Delta 曝敞過深，極易被方向性趨勢突破擊穿')}</strong>】。在量化指標核验中，當前主要受到<strong>【${limiting}】</strong>等因素嚴重拖累，難以提供符合大數信賴區間的正期望回報，強行部署將大大降低風控安全性。建議保持觀望。`
            }
          </p>
        </div>

        <!-- Metrics Breakdowns Table Grid layout -->
        ${decision.metrics ? `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 15px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #334155; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; letter-spacing: 0.5px;">
            📊 多維客觀量化評分子項 / QUANT METRIC EVALUATIONS
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            ${[
              { label: 'DTE Decay', value: decision.metrics.dteScore },
              { label: 'Spread Qual', value: decision.metrics.spreadScore },
              { label: 'Efficiency', value: decision.metrics.marginScore },
              { label: 'Vol Opp', value: decision.metrics.ivScore },
              { label: 'IV Rank', value: decision.metrics.ivRankScore },
              { label: 'Delta Risk', value: decision.metrics.deltaScore },
              { label: 'Liquidity', value: decision.metrics.liquidityScore },
              { label: 'Safety', value: decision.metrics.safetyScore },
            ].map(m => {
              const scoreVal = m.value;
              const barColor = scoreVal >= 70 ? '#10b981' : scoreVal >= 40 ? '#f59e0b' : '#ef4444';
              const evaText = scoreVal >= 70 ? '極佳 (EXCELLENT)' : scoreVal >= 40 ? '一般 (AVERAGE)' : '疲弱 (WEAK)';
              return `
                <div style="padding: 10px; background: #fafafa; border: 1px solid #f1f5f9; border-radius: 6px;">
                  <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">
                    <span>${LABEL_MAP[m.label]}</span>
                    <span style="color: ${barColor}; font-family: monospace;">${scoreVal}% - ${evaText}</span>
                  </div>
                  <div style="width: 100%; height: 5px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                    <div style="width: ${scoreVal}%; height: 100%; background: ${barColor}; border-radius: 999px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Trading Rules Footnote Card -->
        <div style="background-color: #0f172a; padding: 16px; border-radius: 8px; color: #94a3b8; font-size: 9px; line-height: 1.5; border-left: 4px solid #f1f5f9;">
          <div style="color: #f1f5f9; font-weight: 700; font-size: 10px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">⭐ 期權量化與交易守則聲明 / INSTITUTIONAL DISCLOSURE</div>
          本報告由自動化量化決策引擎根據實時市場隱含波動百分位 (IVR)、到期天數 Theta 曲線及標的資金回報效率對比算法一鍵匯出。期權賣方交易涉及無限或重大的資本敞口風險。所有推薦或評分結果均為客觀量化指標之計算展示，不構成任何明確的主觀投資邀約或個股操作買賣要約。進行期權部署時請嚴格遵守「保證金佔用總賬戶 &lt; 50%」之極致防線。
        </div>
      `;

      document.body.appendChild(container);

      // Perform conversion
      const canvas = await html2canvas(container, {
        scale: 2.5, // render super crisp HD DPI
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc'
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190; // A4 margins
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight, undefined, 'FAST');
      
      const filename = `Option_Decision_Report_${bestOption?.symbol || 'Options'}_${new Date().toISOString().substring(0, 10)}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('PDF compiling failed', error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExecute = async () => {
    if (!bestOption || !onExecute) return;
    
    setIsExecuting(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    onExecute(bestOption);
    setIsExecuting(false);
  };
  const getStatusIcon = () => {
    switch (decision.action) {
      case '做': return <TrendingUp className="w-8 h-8 text-brand-success" />;
      case '不做': return <ShieldCheck className="w-8 h-8 text-brand-danger" />;
      case '平倉':
      case 'Roll': return <AlertTriangle className="w-8 h-8 text-brand-warning" />;
      default: return <Clock className="w-8 h-8 text-zinc-400" />;
    }
  };

  const getStatusColor = () => {
    switch (decision.color) {
      case 'green': return 'bg-brand-success/10 border-brand-success/50 text-brand-success';
      case 'red': return 'bg-brand-danger/10 border-brand-danger/50 text-brand-danger';
      case 'yellow': return 'bg-brand-warning/10 border-brand-warning/50 text-brand-warning';
      default: return 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const RadialScore = ({ score }: { score: number }) => {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const colorClass = getScoreColor(score);
    const darkTheme = decision.action !== '做';

    // Establish dynamic glow/shadow color
    let glowColor = "rgba(239, 68, 68, 0.4)"; // red
    if (score >= 70) glowColor = "rgba(16, 185, 129, 0.55)"; // emerald
    else if (score >= 40) glowColor = "rgba(245, 158, 11, 0.55)"; // amber

    if (!darkTheme) glowColor = "rgba(255, 255, 255, 0.65)"; // white on action '做'

    return (
      <div className="relative flex items-center justify-center w-20 h-20">
        {/* Real-time score update glow wave */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`glow-${score}`}
            initial={{ scale: 0.8, opacity: 0.9 }}
            animate={{ scale: 1.4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `0 0 16px 6px ${glowColor}`,
            }}
          />
        </AnimatePresence>

        {/* Real-time shimmer streak diagonal wipe */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none opacity-20">
          <motion.div
            key={`shimmer-${score}`}
            initial={{ x: "-100%", y: "-100%" }}
            animate={{ x: "100%", y: "100%" }}
            transition={{ duration: 1.3, ease: "easeInOut" }}
            className="w-[200%] h-[200%] bg-gradient-to-tr from-transparent via-white/45 to-transparent rotate-45"
          />
        </div>

        <svg className="w-full h-full transform -rotate-90 z-10">
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className={darkTheme ? "text-slate-100" : "text-slate-950/20"}
          />
          <motion.circle
            cx="40"
            cy="40"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={cn(
              "transition-colors duration-500",
              darkTheme ? colorClass : "text-slate-950"
            )}
            strokeLinecap="round"
            key={`circle-${score}`}
            style={{
              filter: darkTheme 
                ? `drop-shadow(0 0 3px ${glowColor})` 
                : "none"
            }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center z-10 select-none">
          <span className={cn(
            "text-[9px] font-black uppercase tracking-tighter opacity-60 leading-none mb-0.5",
            darkTheme ? "text-slate-500" : "text-slate-950"
          )}>綜合評分</span>
          <motion.span 
            key={`score-text-${score}`}
            initial={{ scale: 0.85, filter: "brightness(1.5)" }}
            animate={{ scale: 1, filter: "brightness(1)" }}
            transition={{ duration: 0.4 }}
            className={cn(
              "text-xl font-mono font-black leading-none",
              darkTheme ? colorClass : "text-slate-950"
            )}
          >
            {score}
          </motion.span>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={
        decision.action === '做'
          ? {
              scale: [1, 1.012, 1],
              boxShadow: [
                "0 20px 40px -12px rgba(16, 185, 129, 0.2)",
                "0 20px 40px -12px rgba(16, 185, 129, 0.35)",
                "0 20px 40px -12px rgba(16, 185, 129, 0.2)",
              ],
              opacity: 1,
              y: 0,
            }
          : {
              opacity: 1,
              y: 0,
              scale: 1,
              boxShadow: "0 4px 12px -5px rgba(0, 0, 0, 0.05)",
            }
      }
      transition={{
        scale: decision.action === '做'
          ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
          : { duration: 0.3 },
        boxShadow: decision.action === '做'
          ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
          : { duration: 0.3 },
        opacity: { duration: 0.4 },
        y: { duration: 0.4 },
      }}
      className={cn(
        "decision-card p-6 rounded-lg transition-all duration-500 border shadow-sm",
        decision.action === '做' 
          ? "bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white border-emerald-600 shadow-md" 
          : "bg-white border-slate-200 text-slate-800"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className={cn(
            "text-[10px] font-black uppercase tracking-widest block mb-1",
            decision.action === '做' ? "text-slate-100/75" : "text-slate-400"
          )}>
            今日決策結論
          </span>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black uppercase tracking-tight leading-tight">
              {decision.action === '做' ? '推薦執行交易' : decision.action === '不做' ? '不建議操作' : decision.action}
            </h2>
          </div>
          <div className="mt-2.5">
            <button
              onClick={handleDownloadPDF}
              disabled={isExportingPDF}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-wider transition-all select-none hover:shadow-2xs active:scale-97 disabled:opacity-50 cursor-pointer",
                decision.action === '做'
                  ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  : "bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200/50"
              )}
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>報告產出中...</span>
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  <span>下載 PDF 決策報告</span>
                </>
              )}
            </button>
          </div>
        </div>
        <RadialScore score={decision.score} />
      </div>

      <div className={cn(
        "mt-6 p-5 rounded-lg border flex flex-col gap-4 text-xs leading-relaxed",
        decision.action === '做' 
          ? "bg-slate-950/20 border-white/10 text-white" 
          : "bg-slate-50 border-slate-200/60 text-slate-700 font-medium"
      )}>
        {/* Why Execute or Not */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            {decision.action === '做' ? (
              <TrendingUp className="w-4 h-4 text-emerald-300 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span className={cn(
              "font-black uppercase tracking-wider text-[11px]",
              decision.action === '做' ? "text-emerald-300" : "text-slate-600"
            )}>
              每日決策結論與成因分析 (Why or Why Not)
            </span>
          </div>
          <p className="text-[11px] leading-relaxed pl-6">
            {decision.action === '做' ? (
              <span>
                系統推薦執行此交易。主要原因是由於該期權合約具有<strong>【{primary}】</strong>等極佳量化優勢。此時賣出開倉不僅能最大化獲取時間到期 Theta 溢價，而且享有高達 {bestOption?.safetyDistance ? (bestOption.safetyDistance * 100).toFixed(1) : '8.5'}% 的行權防守距離（與正股現價之安全緩衝極為充裕）。
              </span>
            ) : (
              <span>
                系統此時<strong>不建議執行建倉操作</strong>。
                {decision.reason.includes('Closed') || decision.reason.includes('Hours') ? (
                  `主要原因為：【常規非交易時段（${decision.reason}）】。港交所期權在收市或波动性不穩階段開倉，滑點磨損與不確定風險極重。請在交易窗口評估。`
                ) : (
                  `主要原因在於：【${decision.reason.replace(/DTE < 14/g, '到期天數小於14天（面臨高Gamma尾部風險）').replace(/Spread 過闊/g, '買賣差差過寬（流動性摩擦陷阱）').replace(/Margin \/ Premium > 60x/g, '保證金儲備率偏高（資金槓桿效率低）').replace(/Delta > 0.45/g, 'Delta值大（過於實值，方向風險大）')}】。在各項指標中，當前主要受制於【${limiting}】，因而不具備高勝率的盈虧回報比。`
                )}
              </span>
            )}
          </p>
        </div>

        {/* Suggestion on Which One */}
        <div className="pt-3.5 border-t border-dashed" style={{ borderColor: decision.action === '做' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className={cn(
              "font-black uppercase tracking-wider text-[11px]",
              decision.action === '做' ? "text-emerald-300" : "text-slate-600"
            )}>
              具體合約選取與操作建議 (Suggestion Detail)
            </span>
          </div>
          <div className="pl-6 text-[11px] leading-relaxed">
            {bestOption ? (
              decision.action === '做' ? (
                <div>
                  🎯 <strong>首選推薦合約：</strong>建議在合適常規開市時段交易 <strong>{bestOption.symbol} 的 {bestOption.type === 'Put' ? '認沽 Put' : '認購 Call'}</strong>（行權價: <strong>${bestOption.strike}</strong>，到期日: {bestOption.expiry} 剩餘 {calculateDTE(bestOption.expiry)} 天 DTE）。
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-mono text-emerald-100">
                    <span>預估收受權利金: ${bestOption.premium.toFixed(2)}</span>
                    <span>|</span>
                    <span>保證金回報比: {(bestOption.premium * 100 / (bestOption.margin || 100)).toFixed(1)}%</span>
                    <span>|</span>
                    <span>佔用保證金: ${bestOption.margin.toFixed(0)}</span>
                  </div>
                </div>
              ) : (
                <div>
                  🔍 <strong>最接近及格線候選：</strong>在當前監看的全部期權鏈中，量化策略評分最高的是 <strong>{bestOption.symbol} {bestOption.type.includes('Put') ? '認沽 Put' : '認購 Call'} @ {bestOption.strike}</strong>（DTE: {calculateDTE(bestOption.expiry)} 天，當前核心評分: {decision.score} 分）。
                  <p className="mt-1 text-[10px] text-slate-500 leading-normal">
                    但由於該候選合約目前有<strong>【{limiting}】</strong>的嚴重短板，其綜合評等低於 80 分標準，<strong>強行交易將降低操作期望值</strong>。因此建議此時<strong>「保持空手/維持觀望」</strong>。已有的多頭/空頭自選名單，可待其 IV Rank 回升、價差收縮後再進行跟進開倉。
                  </p>
                </div>
              )
            ) : (
              <p className="text-slate-400 italic">暫無合約數據導入，請在左側添加或選取自選股以刷新本中樞。</p>
            )}
          </div>
        </div>
      </div>

      {decision.metrics && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'DTE Decay', value: decision.metrics.dteScore },
            { label: 'Spread Qual', value: decision.metrics.spreadScore },
            { label: 'Efficiency', value: decision.metrics.marginScore },
            { label: 'Vol Opp', value: decision.metrics.ivScore },
            { label: 'IV Rank', value: decision.metrics.ivRankScore },
            { label: 'Delta Risk', value: decision.metrics.deltaScore },
            { label: 'Liquidity', value: decision.metrics.liquidityScore },
            { label: 'Safety', value: decision.metrics.safetyScore },
          ].map((m) => {
            const theme = METRIC_THEMES[m.label] || {
              border: 'border-slate-200/50',
              borderHover: 'hover:border-slate-300',
              bg: 'bg-slate-50',
              text: 'text-slate-700',
              badgeBg: 'bg-slate-100',
              progressBg: 'bg-slate-500',
              glow: 'shadow-xs'
            };

            const barBgClass = decision.action === '做'
              ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
              : theme.progressBg;

            const txtColorClass = m.value >= 70
              ? theme.text + ' font-black'
              : m.value >= 40 
                ? 'text-amber-600 font-extrabold' 
                : 'text-rose-600 font-extrabold';

            return (
              <div 
                key={m.label} 
                className={cn(
                  "p-2.5 rounded-lg border transition-all duration-300 group relative",
                  decision.action === '做'
                    ? "bg-slate-950/25 border-white/10 hover:bg-slate-950/40 hover:border-white/20"
                    : `${theme.bg} ${theme.border} ${theme.borderHover} ${theme.glow}`
                )}
              >
                <div className="flex justify-between items-center text-[10px] uppercase font-bold mb-1.5 opacity-90">
                  <div className={cn(
                    "flex items-center gap-1 cursor-help",
                    decision.action === '做' ? 'text-slate-100' : 'text-slate-500'
                  )}>
                    <span>{LABEL_MAP[m.label] || m.label}</span>
                    <HelpCircle className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className={cn("font-mono font-black text-sm", decision.action === '做' ? 'text-white font-extrabold' : txtColorClass)}>{m.value}%</span>
                </div>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 border border-slate-950 rounded shadow-md z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 origin-bottom-left">
                  <p className="text-[10px] text-slate-200 normal-case leading-snug font-medium">
                    {METRIC_DESCRIPTIONS[m.label]}
                  </p>
                  <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-800" />
                </div>

                <div className={cn(
                  "w-full h-1.5 rounded-full overflow-hidden",
                  decision.action === '做' ? "bg-slate-950/30" : "bg-slate-200/80"
                )}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${m.value}%` }}
                    className={cn("h-full rounded-full transition-all duration-500", barBgClass)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
