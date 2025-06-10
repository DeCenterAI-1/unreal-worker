import { supabase, queueName } from "../config";
import { QueueJob } from "../index.d";

export class QueueService {
  static async fetchJobs(): Promise<QueueJob[]> {
    console.log("🔄 Checking queue...");
    const { data, error } = await supabase.rpc("read_from_queue", {
      queue_name: queueName,
      vt: 30,
      qty: 1,
    });

    if (error) throw error;
    return data as QueueJob[];
  }

  static async deleteJob(msgId: string): Promise<void> {
    const { error } = await supabase.rpc("delete_from_queue", {
      queue_name: queueName,
      msg_id: msgId,
    });
    
    if (error) throw error;
  }
}