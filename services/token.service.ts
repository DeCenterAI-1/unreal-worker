import { QueueJob } from "../index.d";
import { funderPrivateKey } from "../config";
import { transferUnrealTokens } from "../tokenTransfer";

const processedTokenTransfers = new Set<string>();

export class TokenService {
  static async handleTokenTransfer(job: QueueJob, privateKey: string): Promise<void> {
    const jobKey = `${job.msg_id}`;
    
    if (processedTokenTransfers.has(jobKey)) {
      console.log(`⏭️ Skipping token transfer for job ${job.msg_id}`);
      return;
    }

    try {
      console.log(`🔄 Starting token transfer for job ${job.msg_id}`);
      const txResults = await transferUnrealTokens(privateKey);
      
      job.message.tokenTransactions = txResults;
      processedTokenTransfers.add(jobKey);
      
      console.log(`✅ Token transfer completed for job ${job.msg_id}`);
    } catch (error) {
      console.error(`❌ Token transfer failed for job ${job.msg_id}:`, error);
      throw error;
    }
  }
}