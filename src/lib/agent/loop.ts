import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import type { DecisionReceipt, Decision } from "../types";
import { CryptoPriceFeed } from "./price-feed";
import { EmaCrossRsiStrategy } from "./strategy";
import { runInference, setupCompute } from "../0g/compute";
import { uploadReceipt } from "../0g/storage";
import { logDecisionOnChain } from "../0g/chain";
import { saveDecision, getOpenDecisions, markDecision } from "../db";

const AGENT_ID = "verifialpha-v1";
const ASSET = process.env.ASSET || "BTC-USD";

const priceFeed = new CryptoPriceFeed();
const strategy = new EmaCrossRsiStrategy(ASSET);

function buildPrompt(asset: string, features: Record<string, any>): string {
  return `You are a disciplined trading analyst. You are given precomputed technical
features for ${asset}. Do NOT recompute or invent numbers. Based ONLY on these
features, return a single trading decision.

Features: ${JSON.stringify(features)}
Recent context: EMA crossover is ${features.emaCrossover}, trend is ${features.trend}

Respond with ONLY this JSON, no prose:
{"decision":"LONG"|"SHORT"|"FLAT","confidence":<0..1>,"rationale":"<=240 chars"}`;
}

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

function parseAIResponse(content: string): { decision: Decision; confidence: number; rationale: string } {
  // Strip markdown code fences if present
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  // Try to extract JSON from the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");

  const parsed = JSON.parse(jsonMatch[0]);

  const decision = parsed.decision?.toUpperCase();
  if (!["LONG", "SHORT", "FLAT"].includes(decision)) {
    throw new Error(`Invalid decision: ${parsed.decision}`);
  }

  const confidence = Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.5));
  const rationale = (parsed.rationale || "No rationale provided").slice(0, 240);

  return { decision: decision as Decision, confidence, rationale };
}

export async function runAgentLoop(): Promise<DecisionReceipt> {
  // 1. Ensure compute is set up
  await setupCompute();

  // 2. Fetch candles
  const candles = await priceFeed.fetchCandles(ASSET, 100);
  const currentPrice = candles[candles.length - 1].close;

  // 3. Compute features (deterministic)
  const features = strategy.computeFeatures(candles);

  // 4. Build prompt and run TEE-verified inference
  const prompt = buildPrompt(ASSET, features);
  const promptHash = hashPrompt(prompt);
  const inference = await runInference(prompt);

  // 5. Parse the AI decision
  const { decision, confidence, rationale } = parseAIResponse(inference.content);

  // 6. Build the receipt (without storage/chain hashes yet)
  const receipt: DecisionReceipt = {
    id: uuidv4(),
    agentId: AGENT_ID,
    asset: ASSET,
    timestamp: Date.now(),
    priceAtDecision: currentPrice,
    features,
    promptHash,
    model: inference.model,
    providerAddress: inference.providerAddress,
    chatID: inference.chatId,
    decision,
    confidence,
    rationale,
    teeValid: inference.isValid,
    storageRootHash: "",
    storageTxHash: "",
    chainDecisionId: 0,
    chainTxHash: "",
  };

  // 7. Upload to 0G Storage
  const storageResult = await uploadReceipt(JSON.stringify(receipt));
  receipt.storageRootHash = storageResult.rootHash;
  receipt.storageTxHash = storageResult.txHash;

  // 8. Log on 0G Chain
  const chainResult = await logDecisionOnChain(storageResult.rootHash, decision);
  receipt.chainDecisionId = chainResult.decisionId;
  receipt.chainTxHash = chainResult.txHash;

  // 9. Index in DB
  await saveDecision(receipt);

  // 10. Mark-to-market open decisions
  await markToMarket();

  return receipt;
}

async function markToMarket(): Promise<void> {
  try {
    const currentPrice = await priceFeed.fetchCurrentPrice(ASSET);
    const openDecisions = await getOpenDecisions();

    for (const d of openDecisions) {
      if (d.decision === "FLAT") continue;
      const direction = d.decision === "LONG" ? 1 : -1;
      const pnlPercent = direction * ((currentPrice - d.priceAtDecision) / d.priceAtDecision) * 100;
      const pnlAbsolute = direction * (currentPrice - d.priceAtDecision);
      await markDecision(d.id, currentPrice, pnlPercent, pnlAbsolute);
    }
  } catch (e) {
    console.error("Mark-to-market error:", e);
  }
}
