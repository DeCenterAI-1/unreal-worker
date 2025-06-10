export interface QueueJob {
  msg_id: number;
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
