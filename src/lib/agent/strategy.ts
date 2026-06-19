import type { Candle, Features, StrategyModule } from "../types";

/**
 * EMA crossover with RSI filter.
 * Deterministic — no randomness, no AI. Pure math.
 */
export class EmaCrossRsiStrategy implements StrategyModule {
  asset: string;
  private fastPeriod: number;
  private slowPeriod: number;
  private rsiPeriod: number;

  constructor(asset: string = "BTC-USD", fastPeriod = 12, slowPeriod = 26, rsiPeriod = 14) {
    this.asset = asset;
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.rsiPeriod = rsiPeriod;
  }

  computeFeatures(candles: Candle[]): Features {
    const closes = candles.map((c) => c.close);

    const emaFast = this.ema(closes, this.fastPeriod);
    const emaSlow = this.ema(closes, this.slowPeriod);
    const rsi = this.rsi(closes, this.rsiPeriod);

    // Determine crossover state
    let emaCrossover: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (closes.length >= this.slowPeriod + 1) {
      const prevCloses = closes.slice(0, -1);
      const prevFast = this.ema(prevCloses, this.fastPeriod);
      const prevSlow = this.ema(prevCloses, this.slowPeriod);

      if (emaFast > emaSlow && prevFast <= prevSlow) {
        emaCrossover = "BULLISH";
      } else if (emaFast < emaSlow && prevFast >= prevSlow) {
        emaCrossover = "BEARISH";
      } else if (emaFast > emaSlow) {
        emaCrossover = "BULLISH";
      } else if (emaFast < emaSlow) {
        emaCrossover = "BEARISH";
      }
    }

    // Trend description
    let trend = "sideways";
    if (emaFast > emaSlow && rsi > 50) trend = "bullish momentum";
    else if (emaFast < emaSlow && rsi < 50) trend = "bearish momentum";
    else if (rsi > 70) trend = "overbought";
    else if (rsi < 30) trend = "oversold";

    return {
      emaFast: parseFloat(emaFast.toFixed(2)),
      emaSlow: parseFloat(emaSlow.toFixed(2)),
      rsi: parseFloat(rsi.toFixed(2)),
      emaCrossover,
      trend,
    };
  }

  private ema(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1];

    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private rsi(data: number[], period: number): number {
    if (data.length < period + 1) return 50; // neutral default

    let gains = 0;
    let losses = 0;

    // Initial average
    for (let i = 1; i <= period; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Smoothed RSI
    for (let i = period + 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }
}
