import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";

const TRACK_RECORD_ABI = [
  "function logDecision(bytes32 storageRoot, int8 action) external returns (uint256 id)",
  "function count() external view returns (uint256)",
  "function roots(uint256 id) external view returns (bytes32)",
  "event Decision(uint256 indexed id, address indexed agent, bytes32 storageRoot, int8 action, uint64 ts)",
];

function actionToInt8(decision: "LONG" | "SHORT" | "FLAT"): number {
  switch (decision) {
    case "LONG": return 1;
    case "SHORT": return -1;
    case "FLAT": return 0;
  }
}

export interface ChainResult {
  decisionId: number;
  txHash: string;
  blockTimestamp: number;
}

export async function logDecisionOnChain(
  storageRootHash: string,
  decision: "LONG" | "SHORT" | "FLAT"
): Promise<ChainResult> {
  const contractAddress = process.env.TRACKRECORD_ADDRESS;
  if (!contractAddress) {
    throw new Error("TRACKRECORD_ADDRESS not set");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(contractAddress, TRACK_RECORD_ABI, wallet);

  // Convert rootHash to bytes32
  const rootBytes = storageRootHash.startsWith("0x")
    ? storageRootHash
    : `0x${storageRootHash}`;
  // Pad to 32 bytes if needed
  const rootBytes32 = ethers.zeroPadValue(rootBytes, 32);

  const tx = await contract.logDecision(rootBytes32, actionToInt8(decision));
  const receipt = await tx.wait();

  // Parse the Decision event to get the id
  const iface = new ethers.Interface(TRACK_RECORD_ABI);
  let decisionId = 0;
  let blockTimestamp = 0;

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "Decision") {
        decisionId = Number(parsed.args.id);
        blockTimestamp = Number(parsed.args.ts);
        break;
      }
    } catch {
      // Not our event
    }
  }

  return {
    decisionId,
    txHash: receipt.hash,
    blockTimestamp,
  };
}
