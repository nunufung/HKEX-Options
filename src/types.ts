export interface OptionData {
  symbol: string;
  expiry: string;
  strike: number;
  type: 'Call' | 'Put';
  bid: number;
  ask: number;
  last: number;
  iv: number;
  ivRank: number;
  delta: number;
  volume: number;
  oi: number;
  margin: number;
  premium: number;
  underlyingPrice?: number;
  // Calculated fields
  midPrice?: number;
  spreadPercent?: number;
  dte?: number;
  marginEfficiency?: number;
  safetyDistance?: number;
}

export interface Position {
  id: string;
  symbol: string;
  type: 'Short Put' | 'Short Call' | 'Covered Call' | 'Long Put';
  strike: number;
  expiry: string;
  dte: number;
  entryPrice: number;
  currentPrice: number;
  plPercent: number;
  margin: number;
}

export interface HistoricalData {
  date: string;
  price: number;
  iv: number;
}

export interface DecisionResult {
  action: '做' | '不做' | '等待' | '平倉' | 'Roll';
  reason: string;
  score: number; // 0-100
  color: 'red' | 'yellow' | 'green';
  metrics?: {
    dteScore: number;
    spreadScore: number;
    marginScore: number;
    ivScore: number;
    ivRankScore: number;
    deltaScore: number;
    liquidityScore: number;
    safetyScore: number;
  };
}

export interface RiskWeights {
  dteWeight: number;
  spreadWeight: number;
  marginWeight: number;
  ivWeight: number;
  ivRankWeight: number;
  deltaWeight: number;
  liquidityWeight: number;
  safetyWeight: number;
}

export const DEFAULT_WEIGHTS: RiskWeights = {
  dteWeight: 15,
  spreadWeight: 15,
  marginWeight: 15,
  ivWeight: 10,
  ivRankWeight: 15,
  deltaWeight: 15,
  liquidityWeight: 5,
  safetyWeight: 10,
};

export interface Alert {
  id: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface AlertSettings {
  profitTarget: number;
  lossLimit: number;
  dteThreshold: number;
  minScore: number;
  minIV: number;
  minIVRank: number;
  maxDelta: number;
  priceChangeThreshold: number;
  priceTargetAlert: number;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  profitTarget: 0.5,
  lossLimit: -1.0,
  dteThreshold: 21,
  minScore: 85,
  minIV: 0.35,
  minIVRank: 50,
  maxDelta: 0.30,
  priceChangeThreshold: 0.02,
  priceTargetAlert: 0,
};

export interface StockInfo {
  name: string;
  price: number;
  high52: number;
  low52: number;
  marketCap: string;
  peRatio: string | number;
  dividendYield: string;
  isFallback?: boolean;
}

export interface NewsItem {
  id: number;
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'caution';
  date: string;
}
