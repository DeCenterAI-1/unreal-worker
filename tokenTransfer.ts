import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  parseEther,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "./abis/erc20Abi";


import {torusMainnet, TORUS_RPC, UNREAL_COST, UNREAL_DRIP, UNREAL_CLIENT_ADDRESS, UNREAL_TOKEN_ADDRESS, ETH_DRIP, publicClient} from "./config"
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
      transport: http(TORUS_RPC),
    });

    const custodialWallet = createWalletClient({
      account: custodialAccount,
      chain: torusMainnet,
      transport: http(TORUS_RPC),
    });



    console.log(
      `🔄 Transferring ${formatEther(UNREAL_DRIP)}UNREAL from funder to custodial wallet...`
    );

    // Step 1: Transfer 1.0001 UNREAL from funder to custodial wallet
    const funderToWalletTxHash = await funderWallet.writeContract({
      address: UNREAL_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [custodialAccount.address, UNREAL_DRIP],
    });

    console.log(
      `✅ Dripping ${formatEther(UNREAL_DRIP)}UNREAL to custodial wallet. Tx hash: ${funderToWalletTxHash}`
    );

    // Wait for transaction to be mined
    await publicClient.waitForTransactionReceipt({
      hash: funderToWalletTxHash,
    });


    const qfTxHash = await funderWallet.sendTransaction({
      to: custodialAccount.address,
      value: ETH_DRIP,
    });

    console.log(
      `✅ Transferred ${formatEther(ETH_DRIP)} QF to custodial wallet. Tx hash: ${qfTxHash}`
    );
    await publicClient.waitForTransactionReceipt({ hash: qfTxHash });

    // Step 3: Transfer 1 UNREAL from custodial wallet to UnrealClient contract
    console.log(
      `🔄 Paying  ${formatEther(UNREAL_COST)}UNREAL from custodial wallet to UnrealClient contract...`
    );

    // Transfer the tokens to the UnrealClient contract
    const walletToClientTxHash = await custodialWallet.writeContract({
      address: UNREAL_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [UNREAL_CLIENT_ADDRESS, UNREAL_COST],
    });

    console.log(
      `✅ Payed ${formatEther(UNREAL_COST)}UNREALto UnrealClient contract. Tx hash: ${walletToClientTxHash}`
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
