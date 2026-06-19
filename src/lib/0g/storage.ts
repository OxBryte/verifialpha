import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER_URL = process.env.STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai";

function getSigner(): ethers.Wallet {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  return new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
}

export interface StorageResult {
  rootHash: string;
  txHash: string;
}

export async function uploadReceipt(receiptJson: string): Promise<StorageResult> {
  const indexer = new Indexer(INDEXER_URL);
  const signer = getSigner();
  const bytes = new TextEncoder().encode(receiptJson);
  const memData = new MemData(bytes);

  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr !== null) {
    throw new Error(`Merkle tree generation failed: ${treeErr}`);
  }
  const rootHash = tree!.rootHash() as string;

  const [tx, uploadErr] = await indexer.upload(
    memData,
    RPC_URL,
    signer as any,
  );

  if (uploadErr !== null) {
    throw new Error(`Upload failed: ${uploadErr}`);
  }

  // Handle single vs fragmented response
  let txHash: string;
  if ("txHash" in tx) {
    txHash = tx.txHash as string;
  } else {
    txHash = (tx as any).txHashes[0];
  }

  return { rootHash: rootHash!, txHash };
}

export async function downloadReceipt(rootHash: string): Promise<string> {
  const indexer = new Indexer(INDEXER_URL);
  const [blob, err] = await indexer.downloadToBlob(rootHash, { proof: true });
  if (err !== null) {
    throw new Error(`Download failed: ${err}`);
  }
  return await blob.text();
}
