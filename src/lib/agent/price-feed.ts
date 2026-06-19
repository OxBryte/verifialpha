import type { Candle, PriceFeed } from "../types";

/**
 * CoinGecko-based price feed (free, no API key).
 * Uses OHLC endpoint for candles and simple price for current price.
 */
export class CryptoPriceFeed implements PriceFeed {
  async fetchCandles(asset: string, limit: number = 100): Promise<Candle[]> {
    const coinId = this.toCoinGeckoId(asset);
    // CoinGecko OHLC only accepts specific days values: 1, 7, 14, 30, 90, 180, 365
    const validDays = [1, 7, 14, 30, 90, 180, 365];
    const idealDays = Math.ceil(limit / 24);
    const days = validDays.find((d) => d >= idealDays) || 30;
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko OHLC error: ${res.status}`);

    const data: number[][] = await res.json();

    // CoinGecko OHLC returns [timestamp, open, high, low, close]
    // No volume in OHLC endpoint — use 0
    const candles = data.map((k) => ({
      timestamp: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: 0,
    }));

    return candles.slice(-limit);
  }

  async fetchCurrentPrice(asset: string): Promise<number> {
    const coinId = this.toCoinGeckoId(asset);
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko price error: ${res.status}`);
    const data = await res.json();
    return data[coinId].usd;
  }

  private toCoinGeckoId(asset: string): string {
    const [base] = asset.split("-");
    const map: Record<string, string> = {
      BTC: "bitcoin",
      ETH: "ethereum",
      SOL: "solana",
    };
    return map[base] || base.toLowerCase();
  }
}
