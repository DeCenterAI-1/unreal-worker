
import { QueueService } from "./services/queue.service";
import { ProfileService } from "./services/profile.service";
import { TokenService } from "./services/token.service";
import { ApiService } from "./services/api.service";
import Bluebird from "bluebird"

import { QueueJob } from "./index.d";


async function processJob(job: QueueJob): Promise<void> {
  try {
    const profile = await ProfileService.getProfile(job.message.author);
    
    if (profile.wallet?.privateKey) {
      await TokenService.handleTokenTransfer(job, profile.wallet.privateKey);
    }

    await ApiService.processJob(job);
    await QueueService.deleteJob(job.msg_id);
  } catch (error) {
    console.error(`❌ Error processing job ${job.msg_id}:`, error);
  }
}

export async function processQueue() {
  while (true) {
    try {
      const jobs = await QueueService.fetchJobs();
      
      if (jobs.length === 0) {
        await Bluebird.delay(5000);
        continue;
      }

      await Promise.all(jobs.map(processJob));
    } catch (error) {
      console.error("❌ Queue processing error:", error);
      await Bluebird.delay(5000);
    }
  }
}

processQueue();
