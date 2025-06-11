import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  createNonceManager,
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  parseEther,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { jsonRpc } from "viem/nonce";
import { getCachedWallet } from "./cache/wallet";


// Contract addresses
export const UNREAL_TOKEN_ADDRESS = "0xA409B5E5D34928a0F1165c7a73c8aC572D1aBCDB";
export const UNREAL_CLIENT_ADDRESS = "0x6dAC9A69C100983915cf97C078f930501ccEE278";

export const TORUS_RPC = process.env.RPC_URL || "https://rpc.toruschain.com/"

export const UNREAL_DRIP = parseEther(`${1.01}`)
export const ETH_DRIP = parseEther(`${.001}`)
export const UNREAL_COST = parseUnits("1", 18);



export const torusMainnet = defineChain({
  id: 8192,
  name: "Torus Mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "Torus Ether",
    symbol: "TQF",
  },
  rpcUrls: {
    default: { http: [TORUS_RPC] },
  },
  blockExplorers: {
    default: { name: "Torus Explorer", url: TORUS_RPC },
  },
  testnet: false,
});

export const publicClient = createPublicClient({
  chain: torusMainnet,
  transport: http(TORUS_RPC),
});


export const supabaseUrl = process.env.SUPABASE_URL as string;
export const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
export const queueName = process.env.QUEUE_NAME as string;
export const funderPrivateKey = process.env.FUNDER_PRIVATE_KEY as string;

export const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);


// Create account instances
const funderAccount = getCachedWallet(funderPrivateKey)


export const funderWallet = createWalletClient({
  account: funderAccount.account,
  chain: torusMainnet,
  transport: http(TORUS_RPC),
});