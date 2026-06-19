import { NextResponse } from "next/server";
import { getDecisions, getMarks, getAgents } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [decisions, marks, agents] = await Promise.all([
      getDecisions(),
      getMarks(),
      getAgents(),
    ]);

    // Build equity curve from marks
    const sortedMarks = [...marks].sort((a, b) => a.timestamp - b.timestamp);
    let cumPnl = 0;
    const equityCurve = sortedMarks.map((m) => {
      cumPnl += m.pnlPercent;
      return { timestamp: m.timestamp, cumPnl: parseFloat(cumPnl.toFixed(2)) };
    });

    // Attach latest PnL to each decision
    const decisionsWithPnl = decisions
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((d) => {
        const decisionMarks = marks
          .filter((m) => m.decisionId === d.id)
          .sort((a, b) => b.timestamp - a.timestamp);
        const latestMark = decisionMarks[0];
        return {
          ...d,
          currentPnlPercent: latestMark?.pnlPercent ?? 0,
          currentPnlAbsolute: latestMark?.pnlAbsolute ?? 0,
        };
      });

    return NextResponse.json({
      decisions: decisionsWithPnl,
      equityCurve,
      agents: agents.sort((a, b) => b.totalPnlPercent - a.totalPnlPercent),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
