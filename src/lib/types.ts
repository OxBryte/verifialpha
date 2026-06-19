export type Decision = "LONG" | "SHORT" | "FLAT";

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Features {
  emaFast: number;
  emaSlow: number;
  rsi: number;
  emaCrossover: "BULLISH" | "BEARISH" | "NEUTRAL";
  trend: string;
}

export interface DecisionReceipt {
  id: string;
  agentId: string;
  asset: string;
  timestamp: number;
  priceAtDecision: number;

  features: Features;

  promptHash: string;
  model: string;
  providerAddress: string;
  chatID: string;

  decision: Decision;
  confidence: number;
  rationale: string;

  teeValid: boolean;

  storageRootHash: string;
  storageTxHash: string;
  chainDecisionId: number;
  chainTxHash: string;
}

export interface StrategyModule {
  asset: string;
  computeFeatures(candles: Candle[]): Features;
}

export interface PriceFeed {
  fetchCandles(asset: string, limit: number): Promise<Candle[]>;
  fetchCurrentPrice(asset: string): Promise<number>;
}

export interface PnLMark {
  decisionId: string;
  timestamp: number;
  priceAtMark: number;
  pnlPercent: number;
  pnlAbsolute: number;
}
