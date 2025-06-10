import { QueueJob } from "../index.d";

export class ApiService {
  static async processJob(job: QueueJob): Promise<void> {
    const response = await fetch(`${process.env.API_URL}/darts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job.message),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${responseText}`);
    }

    console.log(`✅ API call succeeded for job ${job.msg_id}`);
  }
}