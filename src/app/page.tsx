"use client";

import { useState, useEffect, useCallback } from "react";

interface Decision {
  id: string;
  agentId: string;
  asset: string;
  timestamp: number;
  priceAtDecision: number;
  features: {
    emaFast: number;
    emaSlow: number;
    rsi: number;
    emaCrossover: string;
    trend: string;
  };
  promptHash: string;
  model: string;
  providerAddress: string;
  chatID: string;
  decision: "LONG" | "SHORT" | "FLAT";
  confidence: number;
  rationale: string;
  teeValid: boolean;
  storageRootHash: string;
  storageTxHash: string;
  chainDecisionId: number;
  chainTxHash: string;
  currentPnlPercent: number;
  currentPnlAbsolute: number;
}

interface EquityPoint {
  timestamp: number;
  cumPnl: number;
}

interface Agent {
  id: string;
  totalDecisions: number;
  totalPnlPercent: number;
  winRate: number;
  lastActive: number;
}

export default function Dashboard() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/decisions");
      const data = await res.json();
      setDecisions(data.decisions || []);
      setEquityCurve(data.equityCurve || []);
      setAgents(data.agents || []);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runAgent = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/agent/run", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRunResult(`Decision: ${data.receipt.decision} (${(data.receipt.confidence * 100).toFixed(0)}% confidence)`);
        await fetchData();
      } else {
        setRunResult(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setRunResult(`Error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateHash = (hash: string) => {
    if (!hash) return "N/A";
    return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b border-card-border">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="text-accent">Verifi</span>Alpha
              </h1>
              <p className="mt-2 text-muted max-w-2xl">
                Provably unfakeable AI trading track record.
                Every decision is TEE-verified inference, committed to{" "}
                <span className="text-foreground">0G Storage</span> and timestamped on{" "}
                <span className="text-foreground">0G Chain</span> before the outcome is known.
              </p>
            </div>
            <button
              onClick={runAgent}
              disabled={running}
              className="px-6 py-3 bg-accent hover:bg-accent-dim text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {running ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Running...
                </>
              ) : (
                "Run Agent Now"
              )}
            </button>
          </div>
          {runResult && (
            <div className={`mt-4 px-4 py-2 rounded-lg text-sm font-mono ${
              runResult.startsWith("Error") ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"
            }`}>
              {runResult}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Decisions", value: decisions.length },
            {
              label: "Cumulative PnL",
              value: equityCurve.length > 0
                ? `${equityCurve[equityCurve.length - 1].cumPnl > 0 ? "+" : ""}${equityCurve[equityCurve.length - 1].cumPnl.toFixed(2)}%`
                : "0.00%",
              color: equityCurve.length > 0 && equityCurve[equityCurve.length - 1].cumPnl > 0
                ? "text-accent"
                : equityCurve.length > 0 && equityCurve[equityCurve.length - 1].cumPnl < 0
                ? "text-danger"
                : "text-foreground",
            },
            {
              label: "TEE Verified",
              value: decisions.filter((d) => d.teeValid).length,
            },
            {
              label: "On-Chain Logged",
              value: decisions.filter((d) => d.chainTxHash).length,
            },
          ].map((stat, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-4">
              <div className="text-xs text-muted uppercase tracking-wider">{stat.label}</div>
              <div className={`text-2xl font-bold mt-1 ${(stat as any).color || "text-foreground"}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Equity Curve */}
        <section className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Equity Curve</h2>
          {equityCurve.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted">
              No PnL data yet. Run the agent to generate decisions.
            </div>
          ) : (
            <EquityChart data={equityCurve} />
          )}
        </section>

        <div className="grid grid-cols-3 gap-8">
          {/* Decision Log */}
          <section className="col-span-2 bg-card border border-card-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Decision Log</h2>
            {loading ? (
              <div className="text-muted">Loading...</div>
            ) : decisions.length === 0 ? (
              <div className="text-muted">No decisions yet. Click &quot;Run Agent Now&quot; to start.</div>
            ) : (
              <div className="space-y-2">
                {decisions.map((d) => (
                  <div key={d.id} className="border border-card-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          d.decision === "LONG"
                            ? "bg-accent/20 text-accent"
                            : d.decision === "SHORT"
                            ? "bg-danger/20 text-danger"
                            : "bg-muted/20 text-muted"
                        }`}>
                          {d.decision}
                        </span>
                        <span className="text-sm text-muted">{d.asset}</span>
                        <span className="text-sm text-muted">{formatTime(d.timestamp)}</span>
                        <span className="text-sm">
                          ${d.priceAtDecision.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-xs text-muted">
                          {(d.confidence * 100).toFixed(0)}% conf
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-mono ${
                          d.currentPnlPercent > 0
                            ? "text-accent"
                            : d.currentPnlPercent < 0
                            ? "text-danger"
                            : "text-muted"
                        }`}>
                          {d.currentPnlPercent > 0 ? "+" : ""}
                          {d.currentPnlPercent.toFixed(2)}%
                        </span>
                        {d.teeValid && (
                          <span className="text-accent text-xs font-semibold flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                            Verified
                          </span>
                        )}
                        <svg className={`w-4 h-4 text-muted transition-transform ${expandedId === d.id ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>

                    {expandedId === d.id && (
                      <div className="px-4 pb-4 border-t border-card-border pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Verification</h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${d.teeValid ? "bg-accent" : "bg-danger"}`} />
                                <span className="text-sm">TEE attestation: {d.teeValid ? "valid" : "invalid"}</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-muted">Storage root: </span>
                                <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">
                                  {truncateHash(d.storageRootHash)}
                                </code>
                                {d.storageTxHash && (
                                  <a
                                    href={`https://chainscan-galileo.0g.ai/tx/${d.storageTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-accent text-xs hover:underline"
                                  >
                                    View
                                  </a>
                                )}
                              </div>
                              <div className="text-sm">
                                <span className="text-muted">On-chain: </span>
                                <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">
                                  tx {truncateHash(d.chainTxHash)}
                                </code>
                                {d.chainTxHash && (
                                  <a
                                    href={`https://chainscan-galileo.0g.ai/tx/${d.chainTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-accent text-xs hover:underline"
                                  >
                                    View
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">AI Rationale</h4>
                            <p className="text-sm text-foreground/80 italic">&quot;{d.rationale}&quot;</p>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mt-3">Features</h4>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-muted">EMA Fast:</span>{" "}
                                <span className="font-mono">{d.features.emaFast}</span>
                              </div>
                              <div>
                                <span className="text-muted">EMA Slow:</span>{" "}
                                <span className="font-mono">{d.features.emaSlow}</span>
                              </div>
                              <div>
                                <span className="text-muted">RSI:</span>{" "}
                                <span className="font-mono">{d.features.rsi}</span>
                              </div>
                            </div>
                            <div className="text-xs">
                              <span className="text-muted">Model:</span>{" "}
                              <span className="font-mono">{d.model}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Leaderboard */}
          <section className="bg-card border border-card-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Leaderboard</h2>
            {agents.length === 0 ? (
              <div className="text-muted text-sm">No agents yet.</div>
            ) : (
              <div className="space-y-3">
                {agents.map((a, i) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted w-6">#{i + 1}</span>
                      <div>
                        <div className="text-sm font-medium">{a.id}</div>
                        <div className="text-xs text-muted">
                          {a.totalDecisions} decisions &middot; {(a.winRate * 100).toFixed(0)}% win
                        </div>
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-bold ${
                      a.totalPnlPercent > 0 ? "text-accent" : a.totalPnlPercent < 0 ? "text-danger" : "text-muted"
                    }`}>
                      {a.totalPnlPercent > 0 ? "+" : ""}{a.totalPnlPercent.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* How It Works */}
            <div className="mt-8 pt-6 border-t border-card-border">
              <h3 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wider">How It Works</h3>
              <div className="space-y-3 text-xs text-muted">
                <div className="flex gap-2">
                  <span className="text-accent font-bold shrink-0">1.</span>
                  <span>Deterministic quant features (EMA, RSI) are computed from live price data.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-accent font-bold shrink-0">2.</span>
                  <span>AI model renders judgment via <strong className="text-foreground/70">0G Compute</strong> TEE-verified inference.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-accent font-bold shrink-0">3.</span>
                  <span>Decision receipt is stored on <strong className="text-foreground/70">0G Storage</strong> (immutable).</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-accent font-bold shrink-0">4.</span>
                  <span>Decision is logged on <strong className="text-foreground/70">0G Chain</strong> with block timestamp &mdash; before the outcome is known.</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-card-border mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between text-xs text-muted">
          <span>VerifiAlpha &mdash; 0G Zero Cup Hackathon</span>
          <span>0G Compute + Storage + Chain</span>
        </div>
      </footer>
    </div>
  );
}

function EquityChart({ data }: { data: EquityPoint[] }) {
  if (data.length < 2) {
    return <div className="h-48 flex items-center justify-center text-muted">Insufficient data points.</div>;
  }

  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const minPnl = Math.min(0, ...data.map((d) => d.cumPnl));
  const maxPnl = Math.max(0, ...data.map((d) => d.cumPnl));
  const range = maxPnl - minPnl || 1;

  const x = (i: number) => padding.left + (i / (data.length - 1)) * plotW;
  const y = (v: number) => padding.top + plotH - ((v - minPnl) / range) * plotH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.cumPnl).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  const lastPnl = data[data.length - 1].cumPnl;
  const color = lastPnl >= 0 ? "var(--accent)" : "var(--danger)";

  const yLabels = [minPnl, minPnl + range / 2, maxPnl];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
      <line x1={padding.left} x2={width - padding.right} y1={y(0)} y2={y(0)} stroke="var(--card-border)" strokeDasharray="4,4" />
      {yLabels.map((v, i) => (
        <text key={i} x={padding.left - 8} y={y(v)} fill="var(--muted)" fontSize="10" textAnchor="end" dominantBaseline="middle">
          {v.toFixed(1)}%
        </text>
      ))}
      <path d={area} fill={color} opacity="0.1" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" />
      <circle cx={x(data.length - 1)} cy={y(lastPnl)} r="4" fill={color} />
    </svg>
  );
}
