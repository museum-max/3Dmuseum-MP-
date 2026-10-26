import { CRYPTO_CHAINS, CryptoChainInfo } from '../three/cryptoLogos';

export interface TickerData {
  symbol: string;
  name: string;
  pair: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  color: string;
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
}

export interface MarketTrade {
  id: string;
  pair: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PortfolioBalance {
  usdt: number;
  assets: Record<string, number>; // symbol -> amount
}

export interface UserOrder {
  id: string;
  pair: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  price: number;
  amount: number;
  filled: number;
  status: 'filled' | 'open' | 'cancelled';
  timestamp: number;
}

const INITIAL_BASE_PRICES: Record<string, number> = {
  BTC: 96450.0,
  ETH: 2740.5,
  SOL: 198.8,
  BNB: 642.1,
  XRP: 2.38,
  DOGE: 0.264,
  ADA: 0.885,
  AVAX: 34.2,
  POL: 0.528,
  LINK: 18.9,
  TRX: 0.245,
  USDT: 1.0,
};

class LiveTradingService {
  private tickers: Map<string, TickerData> = new Map();
  private orderBooks: Map<string, OrderBook> = new Map();
  private recentTrades: Map<string, MarketTrade[]> = new Map();
  private candleHistory: Map<string, Candle[]> = new Map();
  private portfolio: PortfolioBalance = {
    usdt: 25000.0,
    assets: {
      BTC: 0.15,
      ETH: 1.8,
      SOL: 12.5,
    },
  };
  private orders: UserOrder[] = [];
  private listeners: Set<() => void> = new Set();
  private intervalId: number | null = null;

  constructor() {
    this.loadFromStorage();
    this.initializeMarkets();
    this.startLiveSimulation();
  }

  private loadFromStorage() {
    try {
      const savedPortfolio = localStorage.getItem('world_core_portfolio');
      if (savedPortfolio) {
        this.portfolio = JSON.parse(savedPortfolio);
      }
      const savedOrders = localStorage.getItem('world_core_orders');
      if (savedOrders) {
        this.orders = JSON.parse(savedOrders);
      }
    } catch {
      // Fallback to defaults
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('world_core_portfolio', JSON.stringify(this.portfolio));
      localStorage.setItem('world_core_orders', JSON.stringify(this.orders));
    } catch {
      // ignore
    }
  }

  private initializeMarkets() {
    CRYPTO_CHAINS.forEach((chain) => {
      if (chain.symbol === 'USDT') return; // quote currency
      const basePrice = INITIAL_BASE_PRICES[chain.symbol] || 10.0;
      const pair = `${chain.symbol}/USDT`;

      // 1. Ticker
      const variance = (Math.random() - 0.45) * 8.5;
      this.tickers.set(chain.symbol, {
        symbol: chain.symbol,
        name: chain.name,
        pair,
        price: basePrice,
        change24h: variance,
        high24h: basePrice * (1 + Math.abs(variance) * 0.01 + 0.02),
        low24h: basePrice * (1 - Math.abs(variance) * 0.01 - 0.02),
        volume24h: basePrice * 45000 + Math.random() * 5000000,
        color: chain.color,
      });

      // 2. Generate Initial Candles
      const candles: Candle[] = [];
      const now = Math.floor(Date.now() / 60000) * 60000;
      let curr = basePrice * 0.95;
      for (let i = 60; i >= 0; i--) {
        const time = now - i * 60000;
        const drift = (Math.random() - 0.48) * (curr * 0.006);
        const open = curr;
        const close = curr + drift;
        const high = Math.max(open, close) + Math.random() * (curr * 0.004);
        const low = Math.min(open, close) - Math.random() * (curr * 0.004);
        const volume = Math.random() * (basePrice > 1000 ? 5 : 500) + 1;
        candles.push({ time, open, high, low, close, volume });
        curr = close;
      }
      this.candleHistory.set(chain.symbol, candles);

      // 3. Generate Initial Order Book
      this.generateOrderBook(chain.symbol, basePrice);

      // 4. Initial Trades
      const trades: MarketTrade[] = [];
      for (let i = 0; i < 15; i++) {
        trades.push({
          id: `tr-${Date.now()}-${i}`,
          pair,
          price: basePrice * (1 + (Math.random() - 0.5) * 0.002),
          amount: +(Math.random() * (basePrice > 1000 ? 0.35 : 120)).toFixed(4),
          side: Math.random() > 0.5 ? 'buy' : 'sell',
          timestamp: Date.now() - i * 4000,
        });
      }
      this.recentTrades.set(chain.symbol, trades);
    });
  }

  private generateOrderBook(symbol: string, currentPrice: number) {
    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];
    const depth = 9;

    let bidTotal = 0;
    for (let i = 1; i <= depth; i++) {
      const step = currentPrice * 0.0006 * i;
      const p = currentPrice - step;
      const amt = +(Math.random() * (currentPrice > 1000 ? 0.8 : 250) + 0.1).toFixed(4);
      bidTotal += amt;
      bids.push({ price: p, amount: amt, total: +bidTotal.toFixed(4) });
    }

    let askTotal = 0;
    for (let i = 1; i <= depth; i++) {
      const step = currentPrice * 0.0006 * i;
      const p = currentPrice + step;
      const amt = +(Math.random() * (currentPrice > 1000 ? 0.8 : 250) + 0.1).toFixed(4);
      askTotal += amt;
      asks.push({ price: p, amount: amt, total: +askTotal.toFixed(4) });
    }

    const spread = asks[0] && bids[0] ? +(asks[0].price - bids[0].price).toFixed(4) : 0;
    this.orderBooks.set(symbol, { bids, asks, spread });
  }

  private startLiveSimulation() {
    if (this.intervalId !== null) return;

    this.intervalId = window.setInterval(() => {
      // Pick 2-4 symbols per tick to fluctuate organically
      const symbols = Array.from(this.tickers.keys());
      const selected = symbols.sort(() => 0.5 - Math.random()).slice(0, 4);

      selected.forEach((sym) => {
        const ticker = this.tickers.get(sym);
        if (!ticker) return;

        // Realistic small delta
        const volatility = sym === 'BTC' || sym === 'ETH' ? 0.0012 : 0.0035;
        const pctDelta = (Math.random() - 0.49) * volatility;
        const newPrice = +(ticker.price * (1 + pctDelta)).toFixed(ticker.price > 100 ? 2 : 4);

        ticker.price = newPrice;
        if (newPrice > ticker.high24h) ticker.high24h = newPrice;
        if (newPrice < ticker.low24h) ticker.low24h = newPrice;

        // Trade amount
        const tradeAmount = +(Math.random() * (newPrice > 1000 ? 0.45 : 180) + 0.05).toFixed(4);
        const side: 'buy' | 'sell' = pctDelta >= 0 ? 'buy' : 'sell';

        // Add to market trades
        const trades = this.recentTrades.get(sym) || [];
        trades.unshift({
          id: `tr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          pair: ticker.pair,
          price: newPrice,
          amount: tradeAmount,
          side,
          timestamp: Date.now(),
        });
        if (trades.length > 25) trades.pop();
        this.recentTrades.set(sym, trades);

        // Update latest candle
        const candles = this.candleHistory.get(sym) || [];
        const lastCandle = candles[candles.length - 1];
        const nowMinute = Math.floor(Date.now() / 60000) * 60000;

        if (lastCandle && lastCandle.time === nowMinute) {
          lastCandle.close = newPrice;
          if (newPrice > lastCandle.high) lastCandle.high = newPrice;
          if (newPrice < lastCandle.low) lastCandle.low = newPrice;
          lastCandle.volume += tradeAmount;
        } else {
          // New candle minute
          candles.push({
            time: nowMinute,
            open: newPrice,
            high: newPrice,
            low: newPrice,
            close: newPrice,
            volume: tradeAmount,
          });
          if (candles.length > 80) candles.shift();
        }

        // Re-generate order book around new price
        this.generateOrderBook(sym, newPrice);

        // Check if any open limit orders can be filled
        this.checkLimitOrders(sym, newPrice);
      });

      this.notifyListeners();
    }, 1100);
  }

  private checkLimitOrders(symbol: string, currentPrice: number) {
    let changed = false;
    this.orders.forEach((ord) => {
      if (ord.symbol === symbol && ord.status === 'open') {
        if (ord.side === 'buy' && currentPrice <= ord.price) {
          ord.status = 'filled';
          ord.filled = ord.amount;
          // Add asset to portfolio
          const curr = this.portfolio.assets[symbol] || 0;
          this.portfolio.assets[symbol] = +(curr + ord.amount).toFixed(6);
          changed = true;
        } else if (ord.side === 'sell' && currentPrice >= ord.price) {
          ord.status = 'filled';
          ord.filled = ord.amount;
          // Add USDT to portfolio
          this.portfolio.usdt = +(this.portfolio.usdt + ord.amount * ord.price).toFixed(2);
          changed = true;
        }
      }
    });

    if (changed) {
      this.saveToStorage();
    }
  }

  // --- Public Getters & Actions ---

  public getTickers(): TickerData[] {
    return Array.from(this.tickers.values());
  }

  public getTicker(symbol: string): TickerData | undefined {
    return this.tickers.get(symbol);
  }

  public getOrderBook(symbol: string): OrderBook {
    return this.orderBooks.get(symbol) || { bids: [], asks: [], spread: 0 };
  }

  public getRecentTrades(symbol: string): MarketTrade[] {
    return this.recentTrades.get(symbol) || [];
  }

  public getCandles(symbol: string): Candle[] {
    return this.candleHistory.get(symbol) || [];
  }

  public getPortfolio(): PortfolioBalance {
    return this.portfolio;
  }

  public getEstimatedTotalUSD(): number {
    let total = this.portfolio.usdt;
    for (const [sym, amt] of Object.entries(this.portfolio.assets)) {
      const ticker = this.tickers.get(sym);
      if (ticker) {
        total += amt * ticker.price;
      }
    }
    return total;
  }

  public getOrders(): UserOrder[] {
    return this.orders;
  }

  public placeOrder(order: {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    amount: number;
    limitPrice?: number;
  }): { success: boolean; message: string; order?: UserOrder } {
    const ticker = this.tickers.get(order.symbol);
    if (!ticker) return { success: false, message: 'Invalid trading asset.' };

    const execPrice = order.type === 'market' ? ticker.price : (order.limitPrice || ticker.price);
    const totalCost = order.amount * execPrice;

    if (order.side === 'buy') {
      if (this.portfolio.usdt < totalCost) {
        return {
          success: false,
          message: `Insufficient USDT balance. Need $${totalCost.toFixed(2)}, available: $${this.portfolio.usdt.toFixed(2)}`,
        };
      }

      // Deduct USDT immediately
      this.portfolio.usdt = +(this.portfolio.usdt - totalCost).toFixed(2);

      const newOrder: UserOrder = {
        id: `ord-${Date.now()}`,
        pair: ticker.pair,
        symbol: order.symbol,
        side: 'buy',
        type: order.type,
        price: execPrice,
        amount: order.amount,
        filled: order.type === 'market' ? order.amount : 0,
        status: order.type === 'market' ? 'filled' : 'open',
        timestamp: Date.now(),
      };

      if (order.type === 'market') {
        const currAsset = this.portfolio.assets[order.symbol] || 0;
        this.portfolio.assets[order.symbol] = +(currAsset + order.amount).toFixed(6);
      }

      this.orders.unshift(newOrder);
      this.saveToStorage();
      this.notifyListeners();
      return { success: true, message: `Successfully placed ${order.type.toUpperCase()} BUY order!`, order: newOrder };
    } else {
      // Sell order
      const currentHolding = this.portfolio.assets[order.symbol] || 0;
      if (currentHolding < order.amount) {
        return {
          success: false,
          message: `Insufficient ${order.symbol} holding. Have ${currentHolding}, requested: ${order.amount}`,
        };
      }

      // Lock/deduct asset
      this.portfolio.assets[order.symbol] = +(currentHolding - order.amount).toFixed(6);

      const newOrder: UserOrder = {
        id: `ord-${Date.now()}`,
        pair: ticker.pair,
        symbol: order.symbol,
        side: 'sell',
        type: order.type,
        price: execPrice,
        amount: order.amount,
        filled: order.type === 'market' ? order.amount : 0,
        status: order.type === 'market' ? 'filled' : 'open',
        timestamp: Date.now(),
      };

      if (order.type === 'market') {
        this.portfolio.usdt = +(this.portfolio.usdt + totalCost).toFixed(2);
      }

      this.orders.unshift(newOrder);
      this.saveToStorage();
      this.notifyListeners();
      return { success: true, message: `Successfully placed ${order.type.toUpperCase()} SELL order!`, order: newOrder };
    }
  }

  public cancelOrder(orderId: string): boolean {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'open') return false;

    order.status = 'cancelled';
    // Refund locked funds
    if (order.side === 'buy') {
      const refund = order.amount * order.price;
      this.portfolio.usdt = +(this.portfolio.usdt + refund).toFixed(2);
    } else {
      const curr = this.portfolio.assets[order.symbol] || 0;
      this.portfolio.assets[order.symbol] = +(curr + order.amount).toFixed(6);
    }

    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  public resetDemoPortfolio() {
    this.portfolio = {
      usdt: 25000.0,
      assets: {
        BTC: 0.15,
        ETH: 1.8,
        SOL: 12.5,
      },
    };
    this.orders = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Trading listener error:', e);
      }
    });
  }
}

export const liveTradingService = new LiveTradingService();
