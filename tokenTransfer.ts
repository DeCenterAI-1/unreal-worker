import {
  createWalletClient,
  formatEther,
  http,
  WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "./abis/erc20Abi";
import { funderWallet } from "./config";
import {
  torusMainnet,
  TORUS_RPC,
  UNREAL_COST,
  UNREAL_DRIP,
  UNREAL_CLIENT_ADDRESS,
  UNREAL_TOKEN_ADDRESS,
  ETH_DRIP,
  publicClient,
} from "./config";

// ---- Wallet cache with 1 hour TTL ----
import Cache from 'timed-cache';

const custodialWalletCache = new Cache({ defaultTtl: 60 * 60 * 1000 }); 

function getCachedCustodialWallet(privateKey: string): WalletClient {
  let wallet = custodialWalletCache.get(privateKey) as WalletClient;
  if (wallet) return wallet;

  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error(`Invalid private key format: ${privateKey}`);
  }

  const custodialAccount = privateKeyToAccount(privateKey as `0x${string}`);
  wallet = createWalletClient({
    account: custodialAccount,
    chain: torusMainnet,
    transport: http(TORUS_RPC),
  });
  custodialWalletCache.put(privateKey, wallet);
  return wallet;
}

/**
 * Transfer UNREAL tokens from funder to custodial wallet and then to UnrealClient contract
 *
 * @param custodialPrivateKey Private key of the custodial wallet
 * @returns Object containing transaction hashes
 */
export async function transferUnrealTokens(
  custodialPrivateKey: string
): Promise<{ funderToWalletTxHash: string; walletToClientTxHash: string }> {
  try {
    const custodialWallet = getCachedCustodialWallet(custodialPrivateKey);
    const custodialAccount = custodialWallet.account;

    console.log(
      `🔄 Transferring ${formatEther(UNREAL_DRIP)} UNREAL from funder to custodial wallet...`
    );

    // Step 1: Transfer UNREAL from funder to custodial wallet
    const funderToWalletTxHash = await funderWallet.writeContract({
      address: UNREAL_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [custodialAccount.address, UNREAL_DRIP],
    });

    console.log(
      `✅ Dripping ${formatEther(UNREAL_DRIP)} UNREAL to custodial wallet. Tx hash: ${funderToWalletTxHash}`
    );

    await publicClient.waitForTransactionReceipt({
      hash: funderToWalletTxHash,
    });

    // Step 2: Send ETH for gas to custodial wallet
    const qfTxHash = await funderWallet.sendTransaction({
      to: custodialAccount.address,
      value: ETH_DRIP,
    });

    console.log(
      `✅ Transferred ${formatEther(ETH_DRIP)} ETH to custodial wallet. Tx hash: ${qfTxHash}`
    );

    await publicClient.waitForTransactionReceipt({ hash: qfTxHash });

    // Step 3: Transfer UNREAL from custodial wallet to UnrealClient contract
    console.log(
      `🔄 Paying ${formatEther(UNREAL_COST)} UNREAL from custodial wallet to UnrealClient contract...`
    );

    const walletToClientTxHash = await custodialWallet.writeContract({
      address: UNREAL_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [UNREAL_CLIENT_ADDRESS, UNREAL_COST],
    });

    console.log(
      `✅ Paid ${formatEther(UNREAL_COST)} UNREAL to UnrealClient contract. Tx hash: ${walletToClientTxHash}`
    );

    await publicClient.waitForTransactionReceipt({
      hash: walletToClientTxHash,
    });

    return {
      funderToWalletTxHash,
      walletToClientTxHash,
    };
  } catch (error) {
    console.error("❌ Error transferring UNREAL tokens:", error);
    throw error;
  }
}
