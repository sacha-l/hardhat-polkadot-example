#!/usr/bin/env ts-node

import "dotenv/config";
import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";
import fs from "fs";
import path from "path";

async function main() {
  const { WESTEND_RPC_URL, PRIVATE_KEY, WESTIES_TOKEN_ADDRESS } = process.env;
  if (!WESTEND_RPC_URL || !PRIVATE_KEY || !WESTIES_TOKEN_ADDRESS) {
    console.error("❌ Please set WESTEND_RPC_URL, PRIVATE_KEY, and WESTIES_TOKEN_ADDRESS in .env");
    process.exit(1);
  }

  // 1) Provider & wallet
  const provider = new JsonRpcProvider(WESTEND_RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  const deployer = await wallet.getAddress();
  
  console.log("🚀 Deploying from:", deployer);
  console.log("🔗 Connected to network:", await provider.getNetwork());
  
  // Check account balance
  const balance = await provider.getBalance(deployer);
  console.log("💰 Account balance:", balance.toString());
  
  if (balance === 0n) {
    console.error("❌ Account has no balance. Please fund it before deploying.");
    process.exit(1);
  }

  // 2) Load ABI + bytecode
  function loadArtifact(name: string) {
    const p = path.resolve(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
    return JSON.parse(fs.readFileSync(p, "utf8")) as { abi: any; bytecode: string };
  }
  
  try {
    const mergedArt = loadArtifact("GuessTheNumberGameWithPot");
    console.log("📄 Contract artifact loaded successfully");
    
    // 3) Deploy the merged contract
    console.log("📦 Preparing to deploy GuessTheNumberGameWithPot...");
    
    const mergedFactory = new ContractFactory(
      mergedArt.abi, 
      mergedArt.bytecode, 
      wallet
    );
    
    // Get current network gas settings
    const feeData = await provider.getFeeData();
    console.log("⛽ Current gas price:", feeData.gasPrice?.toString() || "unknown");
    
    // Deployment options with explicit gas settings
    const deploymentOptions = {
      gasLimit: 3000000,
      gasPrice: feeData.gasPrice || undefined,
      nonce: await provider.getTransactionCount(deployer)
    };
    
    console.log("🔧 Deployment options:", deploymentOptions);
    console.log("📡 Sending deployment transaction...");
    
    // Deploy with explicit token address
    const deployTx = await mergedFactory.getDeployTransaction(
      WESTIES_TOKEN_ADDRESS
    );
    
    // Set gas parameters on deployment transaction and ensure value is explicitly set to zero
    deployTx.gasLimit = BigInt(deploymentOptions.gasLimit);
    if (deploymentOptions.gasPrice) {
      deployTx.gasPrice = deploymentOptions.gasPrice;
    }
    deployTx.nonce = deploymentOptions.nonce;
    
    // Critical: Explicitly set value to 0 to fix "deploy transact not payable" error
    deployTx.value = 0n;
    
    // Sign and send the transaction
    const signedTx = await wallet.signTransaction(deployTx);
    const txResponse = await provider.broadcastTransaction(signedTx);
    
    console.log("📤 Deployment transaction sent:", txResponse.hash);
    console.log("⏳ Waiting for transaction confirmation...");
    
    // Wait for confirmation
    const receipt = await provider.waitForTransaction(txResponse.hash);
    
    if (receipt && receipt.status === 1) {
      // Calculate the contract address
      const contractAddress = receipt.contractAddress;
      console.log("🎮 GuessTheNumberGameWithPot deployed @", contractAddress);
      console.log("✅ Deployment complete!");
      
      // Calculate and display token transfer instructions
      console.log("\n📝 NEXT STEPS:");
      console.log(`1. Send at least ${5 * 10**18} tokens to the contract address: ${contractAddress}`);
      console.log("2. Users can start guessing numbers through the contract");
      console.log("3. After each round (7 minutes), anyone can call endRound() to distribute rewards");
    } else {
      console.error("❌ Deployment failed: Transaction reverted");
    }
    
  } catch (error) {
    console.error("❌ Deployment failed with error:", error);
  }
}

main().catch((e) => {
  console.error("❌ Script execution failed:", e);
  process.exit(1);
});