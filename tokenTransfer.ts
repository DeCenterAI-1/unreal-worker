import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "./abis/erc20Abi";

// Contract addresses
const UNREAL_TOKEN_ADDRESS = "0xA409B5E5D34928a0F1165c7a73c8aC572D1aBCDB";
const UNREAL_CLIENT_ADDRESS = "0x6dAC9A69C100983915cf97C078f930501ccEE278";

export const torusMainnet = defineChain({
  id: 8192,
  name: "Torus Mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "Torus Ether",
    symbol: "TQF",
  },
  rpcUrls: {
    default: { http: ["https://rpc.toruschain.com/"] },
  },
  blockExplorers: {
    default: { name: "Torus Explorer", url: "https://toruscan.com" },
  },
  testnet: false,
});

const publicClient = createPublicClient({
  chain: torusMainnet,
  transport: http(process.env.RPC_URL || "https://rpc.toruschain.com"),
});

/**
 * Transfer UNREAL tokens from funder to custodial wallet and then to UnrealClient contract
 *
 * @param funderPrivateKey Private key of the funder wallet
 * @param custodialPrivateKey Private key of the custodial wallet
 * @returns Object containing transaction hashes
 */
export async function transferUnrealTokens(
  funderPrivateKey: string,
  custodialPrivateKey: string
): Promise<{ funderToWalletTxHash: string; walletToClientTxHash: string }> {
  try {
    // Create account instances
    const funderAccount = privateKeyToAccount(
      funderPrivateKey as `0x${string}`
    );
    const custodialAccount = privateKeyToAccount(
      custodialPrivateKey as `0x${string}`
    );

    // Create wallet clients
    const funderWallet = createWalletClient({
      account: funderAccount,
      chain: torusMainnet,
      transport: http(process.env.RPC_URL || "https://rpc.toruschain.com"),
    });

    const custodialWallet = createWalletClient({
      account: custodialAccount,
      chain: torusMainnet,
      transport: http(process.env.RPC_URL || "https://rpc.toruschain.com"),
    });

    // Amount to transfer: 1.0001 UNREAL tokens (assuming 18 decimals)
    const transferAmount = parseUnits("1.0001", 18);

    // Amount for the client: 1 UNREAL token
    const clientAmount = parseUnits("1", 18);

    console.log(
      "🔄 Transferring 1.0001 UNREAL tokens from funder to custodial wallet..."
    );

    // Step 1: Transfer 1.0001 UNREAL from funder to custodial wallet
    const funderToWalletTxHash = await funderWallet.writeContract({
      address: UNREAL_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [custodialAccount.address, transferAmount],
    });

    console.log(
      `✅ Transferred 1.0001 UNREAL tokens to custodial wallet. Tx hash: ${funderToWalletTxHash}`
    );

    // Wait for transaction to be mined
    await publicClient.waitForTransactionReceipt({
      hash: funderToWalletTxHash,
    });

    // Step 2: Transfer 0.1 QF (native token) to custodial wallet
    const qfAmount = parseEther("0.1");
    const qfTxHash = await funderWallet.sendTransaction({
      to: custodialAccount.address,
      value: qfAmount,
    });

    console.log(
      `✅ Transferred 0.1 QF to custodial wallet. Tx hash: ${qfTxHash}`
    );
    await publicClient.waitForTransactionReceipt({ hash: qfTxHash });

    // Step 3: Transfer 1 UNREAL from custodial wallet to UnrealClient contract
    console.log(
      "🔄 Transferring 1 UNREAL token from custodial wallet to UnrealClient contract..."
    );

    // Transfer the tokens to the UnrealClient contract
    const walletToClientTxHash = await custodialWallet.writeContract({
      address: UNREAL_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [UNREAL_CLIENT_ADDRESS, clientAmount],
    });

    console.log(
      `✅ Transferred 1 UNREAL token to UnrealClient contract. Tx hash: ${walletToClientTxHash}`
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
