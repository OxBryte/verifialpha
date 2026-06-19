import fs from "fs";
import path from "path";
import type { DecisionReceipt, PnLMark } from "../types";

/**
 * Simple file-based DB for development.
 * Replace with Postgres/Supabase for production deploy.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const DECISIONS_FILE = path.join(DATA_DIR, "decisions.json");
const MARKS_FILE = path.join(DATA_DIR, "marks.json");
const AGENTS_FILE = path.join(DATA_DIR, "agents.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(file: string): T[] {
  ensureDir();
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeJson<T>(file: string, data: T[]) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// --- Decisions ---

export async function saveDecision(receipt: DecisionReceipt): Promise<void> {
  const decisions = readJson<DecisionReceipt>(DECISIONS_FILE);
  decisions.push(receipt);
  writeJson(DECISIONS_FILE, decisions);

  // Update agent stats
  await updateAgentStats(receipt.agentId);
}

export async function getDecisions(): Promise<DecisionReceipt[]> {
  return readJson<DecisionReceipt>(DECISIONS_FILE);
}

export async function getDecisionById(id: string): Promise<DecisionReceipt | null> {
  const decisions = readJson<DecisionReceipt>(DECISIONS_FILE);
  return decisions.find((d) => d.id === id) || null;
}

export async function getOpenDecisions(): Promise<DecisionReceipt[]> {
  const decisions = readJson<DecisionReceipt>(DECISIONS_FILE);
  // A decision is "open" if it's LONG or SHORT (not FLAT) and was made less than 24h ago
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return decisions.filter(
    (d) => d.decision !== "FLAT" && d.timestamp > cutoff
  );
}

// --- Marks (PnL) ---

export async function markDecision(
  decisionId: string,
  priceAtMark: number,
  pnlPercent: number,
  pnlAbsolute: number
): Promise<void> {
  const marks = readJson<PnLMark>(MARKS_FILE);
  marks.push({
    decisionId,
    timestamp: Date.now(),
    priceAtMark,
    pnlPercent,
    pnlAbsolute,
  });
  writeJson(MARKS_FILE, marks);
}

export async function getMarks(): Promise<PnLMark[]> {
  return readJson<PnLMark>(MARKS_FILE);
}

// --- Agents ---

interface AgentStats {
  id: string;
  totalDecisions: number;
  totalPnlPercent: number;
  winRate: number;
  lastActive: number;
}

async function updateAgentStats(agentId: string): Promise<void> {
  const agents = readJson<AgentStats>(AGENTS_FILE);
  const decisions = readJson<DecisionReceipt>(DECISIONS_FILE);
  const marks = readJson<PnLMark>(MARKS_FILE);

  const agentDecisions = decisions.filter((d) => d.agentId === agentId);
  const agentMarks = marks.filter((m) =>
    agentDecisions.some((d) => d.id === m.decisionId)
  );

  // Get latest mark per decision
  const latestMarks = new Map<string, PnLMark>();
  for (const m of agentMarks) {
    const existing = latestMarks.get(m.decisionId);
    if (!existing || m.timestamp > existing.timestamp) {
      latestMarks.set(m.decisionId, m);
    }
  }

  const totalPnl = [...latestMarks.values()].reduce((sum, m) => sum + m.pnlPercent, 0);
  const wins = [...latestMarks.values()].filter((m) => m.pnlPercent > 0).length;
  const winRate = latestMarks.size > 0 ? wins / latestMarks.size : 0;

  const idx = agents.findIndex((a) => a.id === agentId);
  const stats: AgentStats = {
    id: agentId,
    totalDecisions: agentDecisions.length,
    totalPnlPercent: parseFloat(totalPnl.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(2)),
    lastActive: Date.now(),
  };

  if (idx >= 0) agents[idx] = stats;
  else agents.push(stats);

  writeJson(AGENTS_FILE, agents);
}

export async function getAgents(): Promise<AgentStats[]> {
  return readJson<AgentStats>(AGENTS_FILE);
}
