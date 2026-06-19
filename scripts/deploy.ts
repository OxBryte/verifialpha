/**
 * Compile and deploy TrackRecord.sol to 0G Testnet.
 * Run: npx tsx scripts/deploy.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import path from "path";

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error("Set PRIVATE_KEY in .env.local");
    process.exit(1);
  }

  // Compile
  const contractPath = path.join(process.cwd(), "contracts", "TrackRecord.sol");
  const source = fs.readFileSync(contractPath, "utf-8");

  const input = {
    language: "Solidity",
    sources: { "TrackRecord.sol": { content: source } },
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  console.log("Compiling TrackRecord.sol...");
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors?.some((e: any) => e.severity === "error")) {
    console.error("Compilation errors:", output.errors);
    process.exit(1);
  }

  const compiled = output.contracts["TrackRecord.sol"]["TrackRecord"];
  const abi = compiled.abi;
  const bytecode = "0x" + compiled.evm.bytecode.object;

  console.log("Compiled successfully");

  // Write ABI for frontend use
  const abiDir = path.join(process.cwd(), "src", "lib", "0g");
  fs.writeFileSync(
    path.join(abiDir, "TrackRecord.json"),
    JSON.stringify({ abi, bytecode }, null, 2)
  );

  // Deploy
  const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log(`Deploying from: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} A0GI`);

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\nTrackRecord deployed to: ${address}`);

  // Update .env.local
  const envPath = path.join(process.cwd(), ".env.local");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  if (envContent.includes("TRACKRECORD_ADDRESS=")) {
    envContent = envContent.replace(
      /TRACKRECORD_ADDRESS=.*/,
      `TRACKRECORD_ADDRESS=${address}`
    );
  } else {
    envContent += `\nTRACKRECORD_ADDRESS=${address}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log(`Written to .env.local`);
  console.log(`\nExplorer: https://chainscan-galileo.0g.ai/address/${address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
