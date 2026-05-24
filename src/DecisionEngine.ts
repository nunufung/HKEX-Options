import { format, differenceInDays, parse } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { OptionData, DecisionResult, RiskWeights, DEFAULT_WEIGHTS } from './types';

const HK_TIMEZONE = 'Asia/Hong_Kong';

export function getHKTime() {
  return toZonedTime(new Date(), HK_TIMEZONE);
}

export function isMarketOpen() {
  const hkNow = getHKTime();
  const day = hkNow.getDay();
  // day: 0 (Sun), 1 (Mon), ..., 6 (Sat)
  if (day === 0 || day === 6) return false;

  const hours = hkNow.getHours();
  const minutes = hkNow.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Morning Session: 09:30 - 12:00 (570 - 720 minutes)
  const isMorning = totalMinutes >= 570 && totalMinutes <= 720;
  // Afternoon Session: 13:00 - 16:00 (780 - 960 minutes)
  const isAfternoon = totalMinutes >= 780 && totalMinutes <= 960;

  return isMorning || isAfternoon;
}

export function calculateDTE(expiryStr: string) {
  try {
    const hkNow = getHKTime();
    const expiry = parse(expiryStr, 'yyyy-MM-dd', new Date());
    return Math.max(0, differenceInDays(expiry, hkNow));
  } catch (e) {
    return 0;
  }
}

export function evaluateOption(option: OptionData, weights: RiskWeights = DEFAULT_WEIGHTS): DecisionResult {
  const hkNow = getHKTime();
  const hours = hkNow.getHours();
  const minutes = hkNow.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  
  // 1. Stability Rule (Retention of existing safety logic)
  if (hours < 10 && hours >= 9) {
    return {
      action: '等待',
      reason: 'HKEX 開市首 30 分鐘報價不穩，請於 10:00am 後再評估。',
      score: 0,
      color: 'yellow'
    };
  }

  // Calculate market hours multiplier
  // Peak: 10:00 - 15:00 (600 - 900 mins)
  let timeMultiplier = 1.0;
  if (totalMinutes >= 600 && totalMinutes <= 900) {
    timeMultiplier = 1.05; // 5% peak bonus
  } else {
    timeMultiplier = 0.95; // 5% reduction for early/late/closed hours
  }

  // Bonus for High Liquidity / Open Interest
  let liquidityBonus = 0;
  if (option.oi > 15000 || option.volume > 1500) liquidityBonus += 5;
  else if (option.oi > 8000 || option.volume > 800) liquidityBonus += 2;

  // Calculate fields
  const mid = (option.bid + option.ask) / 2;
  const spreadPercent = mid > 0 ? (option.ask - option.bid) / mid : 1;
  const dte = calculateDTE(option.expiry);
  const marginEfficiency = option.premium > 0 ? option.margin / option.premium : 999;
  
  // Safety Distance (Percent away from spot)
  const spot = option.underlyingPrice || (option.last > 10 ? option.last : (option.type === 'Put' ? option.strike / 0.95 : option.strike / 1.05));
  const safetyDistance = Math.abs((option.strike / spot) - 1);

  let rejects: string[] = [];

  // Metrics calculation
  let dteScore = 0;
  if (dte >= 21 && dte <= 45) dteScore = 1;
  else if (dte > 45) dteScore = 0.4;
  else if (dte >= 14) dteScore = 0.2;
  else rejects.push('DTE < 14 (High Gamma Risk)');

  let spreadScore = 0;
  if (spreadPercent <= 0.03) spreadScore = 1;
  else if (spreadPercent <= 0.08) spreadScore = 0.7;
  else if (spreadPercent <= 0.15) spreadScore = 0.3;
  else rejects.push('Spread 過闊 (Liquidity Trap)');

  let marginScore = 0;
  if (marginEfficiency <= 20) marginScore = 1;
  else if (marginEfficiency <= 42) marginScore = 0.8;
  else if (marginEfficiency <= 60) marginScore = 0.4;
  else rejects.push('Margin / Premium > 60x (Poor capital efficiency)');

  let ivScore = 0;
  const actualIV = option.iv > 1 ? option.iv / 100 : option.iv;
  if (actualIV > 0.4) ivScore = 1;
  else if (actualIV > 0.25) ivScore = 0.8;
  else ivScore = 0.4;

  let ivRankScore = 0;
  if (option.ivRank >= 70) ivRankScore = 1;
  else if (option.ivRank >= 40) ivRankScore = 0.7;
  else if (option.ivRank >= 20) ivRankScore = 0.3;
  else ivRankScore = 0.1;

  let deltaScore = 0;
  const absDelta = Math.abs(option.delta);
  if (absDelta <= 0.15) deltaScore = 1;
  else if (absDelta <= 0.30) deltaScore = 0.7;
  else if (absDelta <= 0.45) deltaScore = 0.3;
  else rejects.push('Delta > 0.45 (Too ITM/Aggressive)');

  let liquidityScore = 0;
  if (option.oi > 5005 || option.volume > 500) liquidityScore = 1;
  else if (option.oi > 1000) liquidityScore = 0.6;
  else liquidityScore = 0.2;

  let safetyScore = 0;
  if (safetyDistance >= 0.12) safetyScore = 1;
  else if (safetyDistance >= 0.08) safetyScore = 0.8;
  else if (safetyDistance >= 0.04) safetyScore = 0.6;
  else safetyScore = 0.2;

  // Final Weighted Score
  const baseScore = (
    (dteScore * weights.dteWeight) +
    (spreadScore * weights.spreadWeight) +
    (marginScore * weights.marginWeight) +
    (ivScore * weights.ivWeight) +
    (ivRankScore * weights.ivRankWeight) +
    (deltaScore * weights.deltaWeight) +
    (liquidityScore * weights.liquidityWeight) +
    (safetyScore * weights.safetyWeight)
  );

  // Apply Multiplier and Bonus
  const adjustedScore = (baseScore * timeMultiplier) + liquidityBonus;
  const roundedScore = Math.min(100, Math.max(0, Math.round(adjustedScore)));

  const metrics = {
    dteScore: Math.round(dteScore * 100),
    spreadScore: Math.round(spreadScore * 100),
    marginScore: Math.round(marginScore * 100),
    ivScore: Math.round(ivScore * 100),
    ivRankScore: Math.round(ivRankScore * 100),
    deltaScore: Math.round(deltaScore * 100),
    liquidityScore: Math.round(liquidityScore * 100),
    safetyScore: Math.round(safetyScore * 100),
  };

  // Enhanced reasons based on new logic
  if (timeMultiplier < 1) {
    if (totalMinutes >= 960) rejects.push('Market Closed (Execution Risk)');
    else if (totalMinutes >= 900) rejects.push('Post-Optimal Hours (>15:00)');
  }

  // Final Decision Logic
  if (rejects.length > 0) {
    return {
      action: '不做',
      reason: rejects.join(', '),
      score: roundedScore,
      color: 'red',
      metrics
    };
  }

  if (roundedScore >= 80) {
    return {
      action: '做',
      reason: '高盈虧比機會：流動性與安全邊際均符合優質標準。',
      score: roundedScore,
      color: 'green',
      metrics
    };
  }

  if (roundedScore >= 60) {
    return {
      action: '等待',
      reason: `評分 ${roundedScore} 屬中等風險，建議等待波動率回升。`,
      score: roundedScore,
      color: 'yellow',
      metrics
    };
  }

  return {
    action: '不做',
    reason: '評分低於基準，建議放棄該次交易。',
    score: roundedScore,
    color: 'red',
    metrics
  };
}
