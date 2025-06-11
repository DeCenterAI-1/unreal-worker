import Cache from 'timed-cache';
import { jsonRpc } from "viem/nonce";
import {
  torusMainnet,
  TORUS_RPC,
} from "../config";

import {
  createNonceManager,
  createWalletClient,
  formatEther,
  http,
  WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const walletCache = new Cache({ defaultTtl: 60 * 60 * 1000 }); 

export function getCachedWallet(privateKey: string): WalletClient {
  let wallet = walletCache.get(privateKey) as WalletClient;
  if (wallet) return wallet;

  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error(`Invalid private key format: ${privateKey}`);
  }


  const nonceManager = createNonceManager({
    source: jsonRpc(),
  });

  const custodialAccount = privateKeyToAccount(privateKey as `0x${string}`,{nonceManager});
  
  wallet = createWalletClient({
    account: custodialAccount,
    chain: torusMainnet,
    transport: http(TORUS_RPC),
  });
  walletCache.put(privateKey, wallet);
  return wallet;
}