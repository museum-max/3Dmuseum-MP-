import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Wallet,
  Clock,
  DollarSign,
  Layers,
  ChevronDown,
} from 'lucide-react';
import {
  liveTradingService,
  TickerData,
  OrderBook,
  MarketTrade,
  Candle,
  PortfolioBalance,
  UserOrder,
} from '../services/liveTradingService';
import { sound } from '../audio/soundEffects';

interface LiveTradingTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSymbol?: string;
}

export const LiveTradingTerminal: React.FC<LiveTradingTerminalProps> = ({
  isOpen,
  onClose,
  initialSymbol = 'BTC',
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [amountInput, setAmountInput] = useState<string>('');
  const [limitPriceInput, setLimitPriceInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'chart' | 'orders' | 'portfolio'>('chart');
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('1m');
  const [notification, setNotification] = useState<{ text: string; error?: boolean } | null>(null);

  // Trigger state refresh
  const [, setTick] = useState(0);

  useEffect(() => {
    if (initialSymbol) {
      setSelectedSymbol(initialSymbol);
    }
  }, [initialSymbol]);

  useEffect(() => {
    const unsub = liveTradingService.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const tickers: TickerData[] = useMemo(() => liveTradingService.getTickers(), []);
  const ticker: TickerData | undefined = liveTradingService.getTicker(selectedSymbol);
  const orderBook: OrderBook = liveTradingService.getOrderBook(selectedSymbol);
  const recentTrades: MarketTrade[] = liveTradingService.getRecentTrades(selectedSymbol);
  const candles: Candle[] = liveTradingService.getCandles(selectedSymbol);
  const portfolio: PortfolioBalance = liveTradingService.getPortfolio();
  const totalNetWorth: number = liveTradingService.getEstimatedTotalUSD();
  const orders: UserOrder[] = liveTradingService.getOrders();

  // Keep limit price updated with current market price if empty
  useEffect(() => {
    if (ticker && (!limitPriceInput || orderType === 'market')) {
      setLimitPriceInput(ticker.price.toString());
    }
  }, [selectedSymbol, ticker?.price, orderType]);

  if (!isOpen) return null;

  const currentPrice = ticker ? ticker.price : 100;
  const isPositive = ticker ? ticker.change24h >= 0 : true;
  const currentAssetBalance = portfolio.assets[selectedSymbol] || 0;

  const handlePercentageQuickSelect = (pct: number) => {
    sound.playClick();
    if (!ticker) return;
    if (orderSide === 'buy') {
      const availableUsdt = portfolio.usdt * pct;
      const priceToUse = orderType === 'limit' && Number(limitPriceInput) > 0 ? Number(limitPriceInput) : ticker.price;
      const amt = +(availableUsdt / priceToUse).toFixed(ticker.price > 1000 ? 4 : 2);
      setAmountInput(amt > 0 ? amt.toString() : '');
    } else {
      const amt = +(currentAssetBalance * pct).toFixed(ticker.price > 1000 ? 4 : 2);
      setAmountInput(amt > 0 ? amt.toString() : '');
    }
  };

  const handleExecuteOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountInput);
    if (!amount || amount <= 0) {
      setNotification({ text: 'Please enter a valid amount.', error: true });
      return;
    }

    const limitPrice = orderType === 'limit' ? parseFloat(limitPriceInput) : undefined;
    if (orderType === 'limit' && (!limitPrice || limitPrice <= 0)) {
      setNotification({ text: 'Please enter a valid limit price.', error: true });
      return;
    }

    const res = liveTradingService.placeOrder({
      symbol: selectedSymbol,
      side: orderSide,
      type: orderType,
      amount,
      limitPrice,
    });

    if (res.success) {
      sound.playBuy();
      setNotification({ text: res.message });
      setAmountInput('');
    } else {
      sound.playError();
      setNotification({ text: res.message, error: true });
    }

    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleCancelOrder = (orderId: string) => {
    sound.playClick();
    const ok = liveTradingService.cancelOrder(orderId);
    if (ok) {
      setNotification({ text: 'Order cancelled successfully.' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // SVG Candlestick Rendering computations
  const chartHeight = 240;
  const chartWidth = 560;
  const displayCandles = candles.slice(-36);
  const minPrice = Math.min(...displayCandles.map((c) => c.low));
  const maxPrice = Math.max(...displayCandles.map((c) => c.high));
  const priceRange = maxPrice - minPrice || 1;

  const getY = (val: number) => {
    return chartHeight - ((val - minPrice) / priceRange) * (chartHeight - 40) - 20;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-950/95 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/50 overflow-hidden font-mono text-slate-200">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/50">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold tracking-wider text-cyan-300">
                WORLD CORE // LIVE EXCHANGE
              </span>
            </div>

            {/* Asset Pair Selector Dropdown */}
            <div className="relative group">
              <select
                value={selectedSymbol}
                onChange={(e) => {
                  sound.playClick();
                  setSelectedSymbol(e.target.value);
                }}
                className="appearance-none pl-3 pr-8 py-1 bg-slate-800/90 border border-slate-700 rounded-lg text-sm font-bold text-white hover:border-cyan-400 focus:outline-none cursor-pointer"
              >
                {tickers.map((t) => (
                  <option key={t.symbol} value={t.symbol} className="bg-slate-900 text-white">
                    {t.symbol}/USDT ({t.name})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Real-time Ticker Metrics */}
            {ticker && (
              <div className="hidden md:flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-white">
                    ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </span>
                  <span
                    className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${
                      isPositive ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                    }`}
                  >
                    {isPositive ? <ArrowUpRight className="w-3 h-3 inline mr-0.5" /> : <ArrowDownRight className="w-3 h-3 inline mr-0.5" />}
                    {isPositive ? '+' : ''}{ticker.change24h.toFixed(2)}%
                  </span>
                </div>
                <div className="flex flex-col text-[10px] text-slate-400">
                  <span>24h High: <strong className="text-slate-200">${ticker.high24h.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></span>
                  <span>24h Low: <strong className="text-slate-200">${ticker.low24h.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></span>
                </div>
                <div className="hidden lg:flex flex-col text-[10px] text-slate-400">
                  <span>24h Vol: <strong className="text-slate-200">${(ticker.volume24h / 1000000).toFixed(2)}M</strong></span>
                  <span>Connector: <strong className="text-cyan-400">CORE Mesh L1</strong></span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Net Worth Summary Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <span>Balance: </span>
              <strong className="text-white">${portfolio.usdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</strong>
            </div>

            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center justify-between border-b ${
              notification.error
                ? 'bg-rose-950/90 text-rose-300 border-rose-500/40'
                : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
            }`}
          >
            <span>{notification.text}</span>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Grid View */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Left Column: Candlestick Chart & Tabs (cols 7) */}
          <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800">
            {/* Chart Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-1">
                {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      sound.playClick();
                      setTimeframe(tf);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      timeframe === tf
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-amber-400">● MA(7)</span>
                  <span className="text-indigo-400">● MA(25)</span>
                </div>
                <div className="flex items-center gap-1">
                  {(['chart', 'orders', 'portfolio'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        sound.playClick();
                        setActiveTab(tab);
                      }}
                      className={`px-2.5 py-1 rounded text-xs capitalize ${
                        activeTab === tab
                          ? 'bg-slate-800 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Center Area: Chart / Orders / Portfolio */}
            {activeTab === 'chart' && (
              <div className="p-3 flex-1 flex flex-col justify-center bg-slate-950/50">
                <div className="relative w-full overflow-hidden bg-slate-900/40 rounded-xl border border-slate-800/80 p-2">
                  {/* Candlestick SVG Chart */}
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-56 sm:h-64"
                    preserveAspectRatio="none"
                  >
                    {/* Horizontal grid lines */}
                    {[0.2, 0.4, 0.6, 0.8].map((pct) => {
                      const y = chartHeight * pct;
                      const p = maxPrice - pct * priceRange;
                      return (
                        <g key={pct}>
                          <line
                            x1="0"
                            y1={y}
                            x2={chartWidth - 60}
                            y2={y}
                            stroke="#1e293b"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          <text
                            x={chartWidth - 55}
                            y={y + 3}
                            fill="#64748b"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            ${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </text>
                        </g>
                      );
                    })}

                    {/* Candlesticks */}
                    {displayCandles.map((c, idx) => {
                      const step = (chartWidth - 65) / displayCandles.length;
                      const x = idx * step + step / 2;
                      const candleWidth = Math.max(2, step * 0.7);

                      const yOpen = getY(c.open);
                      const yClose = getY(c.close);
                      const yHigh = getY(c.high);
                      const yLow = getY(c.low);

                      const isGreen = c.close >= c.open;
                      const bodyTop = Math.min(yOpen, yClose);
                      const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));

                      return (
                        <g key={c.time} className="transition-all duration-150">
                          {/* Wick */}
                          <line
                            x1={x}
                            y1={yHigh}
                            x2={x}
                            y2={yLow}
                            stroke={isGreen ? '#10b981' : '#f43f5e'}
                            strokeWidth="1.2"
                          />
                          {/* Candle Body */}
                          <rect
                            x={x - candleWidth / 2}
                            y={bodyTop}
                            width={candleWidth}
                            height={bodyHeight}
                            fill={isGreen ? '#10b981' : '#f43f5e'}
                            rx="1"
                          />
                        </g>
                      );
                    })}

                    {/* Current Price Dashed Guide Line */}
                    <line
                      x1="0"
                      y1={getY(currentPrice)}
                      x2={chartWidth - 60}
                      y2={getY(currentPrice)}
                      stroke={isPositive ? '#10b981' : '#f43f5e'}
                      strokeDasharray="2 2"
                      strokeWidth="1.2"
                    />
                    <rect
                      x={chartWidth - 60}
                      y={getY(currentPrice) - 8}
                      width="60"
                      height="16"
                      fill={isPositive ? '#064e3b' : '#881337'}
                      rx="3"
                    />
                    <text
                      x={chartWidth - 56}
                      y={getY(currentPrice) + 3}
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </text>
                  </svg>
                </div>

                {/* Quick Asset Summary row */}
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  <div>
                    <span>Pair: </span>
                    <strong className="text-white">{selectedSymbol}/USDT</strong>
                  </div>
                  <div>
                    <span>Your Holding: </span>
                    <strong className="text-cyan-400">{currentAssetBalance} {selectedSymbol}</strong>
                  </div>
                  <div>
                    <span>Value: </span>
                    <strong className="text-emerald-400">
                      ${(currentAssetBalance * currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="p-3 flex-1 overflow-y-auto max-h-72">
                <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
                  <span>YOUR ORDERS ({orders.length})</span>
                </div>
                {orders.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No orders placed yet. Place your first buy or sell order!
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ord.side === 'buy' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                            }`}
                          >
                            {ord.side}
                          </span>
                          <span className="font-bold text-white">{ord.pair}</span>
                          <span className="text-[10px] text-slate-400">({ord.type})</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right text-[11px]">
                            <div className="text-slate-200">
                              {ord.amount} @ ${ord.price.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Total: ${(ord.amount * ord.price).toFixed(2)}
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              ord.status === 'filled'
                                ? 'bg-emerald-950/80 text-emerald-400'
                                : ord.status === 'open'
                                ? 'bg-amber-950/80 text-amber-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {ord.status}
                          </span>

                          {ord.status === 'open' && (
                            <button
                              onClick={() => handleCancelOrder(ord.id)}
                              className="px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-300 text-[10px] font-bold"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'portfolio' && (
              <div className="p-3 flex-1 overflow-y-auto max-h-72">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs text-slate-400">Total Portfolio Valuation</span>
                    <div className="text-xl font-bold text-white">
                      ${totalNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      sound.playClick();
                      liveTradingService.resetDemoPortfolio();
                      setNotification({ text: 'Demo balances reset to $25,000 USDT.' });
                      setTimeout(() => setNotification(null), 3000);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset Demo Funds</span>
                  </button>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                    <span className="font-bold text-emerald-400">USDT (Tether USD)</span>
                    <strong className="text-white">${portfolio.usdt.toFixed(2)}</strong>
                  </div>
                  {Object.entries(portfolio.assets).map(([sym, amt]) => {
                    const t = tickers.find((x) => x.symbol === sym);
                    const val = amt * (t ? t.price : 0);
                    return (
                      <div
                        key={sym}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{sym}</span>
                          <span className="text-[11px] text-slate-400">{amt} {sym}</span>
                        </div>
                        <strong className="text-slate-200">${val.toFixed(2)}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Middle Column: Live Order Book & Recent Trades (cols 2.5) */}
          <div className="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-slate-800 p-2.5 flex flex-col bg-slate-950/30 text-xs">
            <span className="text-[10px] font-bold text-slate-400 mb-1 tracking-wider uppercase">
              ORDER BOOK
            </span>

            {/* Asks (Red) */}
            <div className="space-y-0.5 text-[10px]">
              {orderBook.asks.slice(-5).reverse().map((ask, i) => (
                <div key={i} className="flex justify-between items-center text-rose-400">
                  <span>${ask.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  <span className="text-slate-400">{ask.amount}</span>
                </div>
              ))}
            </div>

            {/* Current Price Spread Divider */}
            <div className="my-1.5 py-1 px-1.5 rounded bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span className={`text-xs font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] text-slate-500">Spread: ${orderBook.spread}</span>
            </div>

            {/* Bids (Green) */}
            <div className="space-y-0.5 text-[10px]">
              {orderBook.bids.slice(0, 5).map((bid, i) => (
                <div key={i} className="flex justify-between items-center text-emerald-400">
                  <span>${bid.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  <span className="text-slate-400">{bid.amount}</span>
                </div>
              ))}
            </div>

            {/* Recent Live Trades */}
            <div className="mt-3 pt-2 border-t border-slate-800 flex-1 overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">
                RECENT TRADES
              </span>
              <div className="space-y-1 text-[10px] max-h-24 overflow-y-auto">
                {recentTrades.slice(0, 6).map((tr) => (
                  <div key={tr.id} className="flex justify-between items-center">
                    <span className={tr.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}>
                      ${tr.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-400">{tr.amount}</span>
                    <span className="text-[9px] text-slate-500">
                      {new Date(tr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Execution Form (cols 2.5) */}
          <div className="lg:col-span-3 p-3 flex flex-col bg-slate-900/40">
            {/* Buy / Sell Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 mb-3">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setOrderSide('buy');
                }}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  orderSide === 'buy'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                BUY {selectedSymbol}
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setOrderSide('sell');
                }}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  orderSide === 'sell'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                SELL {selectedSymbol}
              </button>
            </div>

            {/* Order Type Selector */}
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="text-slate-400">Order Type</span>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setOrderType('market');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    orderType === 'market' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'
                  }`}
                >
                  Market
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setOrderType('limit');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    orderType === 'limit' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'
                  }`}
                >
                  Limit
                </button>
              </div>
            </div>

            <form onSubmit={handleExecuteOrder} className="space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                {/* Limit Price Input if Limit Order */}
                {orderType === 'limit' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Price (USDT)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={limitPriceInput}
                        onChange={(e) => setLimitPriceInput(e.target.value)}
                        className="w-full pl-3 pr-12 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                        placeholder="0.00"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                        USDT
                      </span>
                    </div>
                  </div>
                )}

                {/* Amount Input */}
                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
                    <span>Amount</span>
                    <span>
                      {orderSide === 'buy'
                        ? `Avail: $${portfolio.usdt.toFixed(2)} USDT`
                        : `Avail: ${currentAssetBalance} ${selectedSymbol}`}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full pl-3 pr-12 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                      placeholder="0.00"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      {selectedSymbol}
                    </span>
                  </div>
                </div>

                {/* Percentage Quick Select Buttons */}
                <div className="grid grid-cols-4 gap-1">
                  {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handlePercentageQuickSelect(pct)}
                      className="py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-[10px] font-bold text-slate-300"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                </div>

                {/* Estimated Total Calculation */}
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs flex justify-between items-center">
                  <span className="text-slate-400">Total Est.</span>
                  <strong className="text-white">
                    $
                    {(
                      (parseFloat(amountInput) || 0) *
                      (orderType === 'limit' && parseFloat(limitPriceInput) > 0
                        ? parseFloat(limitPriceInput)
                        : currentPrice)
                    ).toFixed(2)}{' '}
                    USDT
                  </strong>
                </div>
              </div>

              {/* Submit Execution Button */}
              <button
                type="submit"
                className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-xl transition-all cursor-pointer ${
                  orderSide === 'buy'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                }`}
              >
                {orderSide === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
