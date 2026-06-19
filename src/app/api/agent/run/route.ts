import { NextResponse } from "next/server";
import { runAgentLoop } from "@/lib/agent/loop";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  try {
    const receipt = await runAgentLoop();
    return NextResponse.json({ success: true, receipt });
  } catch (error: any) {
    console.error("Agent loop error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
