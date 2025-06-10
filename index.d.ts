export interface QueueJob {
  msg_id: string;
  message: {
    module: string;
    version: string;
    author: string;
    inputs: {
      cpu: number | null;
      ram: number | null;
    };
    tokenTransactions?: {
      funderToWalletTxHash: string;
      walletToClientTxHash: string;
    };
  };
}

export interface ProfileData {
  credit_balance: number;
  wallet?: {
    address: string;
    privateKey: string;
  };
}