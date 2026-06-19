import { NextResponse } from "next/server";
import { getDecisionById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decision = await getDecisionById(id);
    if (!decision) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    return NextResponse.json({
      decision,
      verification: {
        teeValid: decision.teeValid,
        storageRootHash: decision.storageRootHash,
        storageTxHash: decision.storageTxHash,
        chainDecisionId: decision.chainDecisionId,
        chainTxHash: decision.chainTxHash,
        storageExplorerUrl: decision.storageTxHash
          ? `https://chainscan-galileo.0g.ai/tx/${decision.storageTxHash}`
          : null,
        chainExplorerUrl: decision.chainTxHash
          ? `https://chainscan-galileo.0g.ai/tx/${decision.chainTxHash}`
          : null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
