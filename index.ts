import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const queueName = process.env.QUEUE_NAME as string;

const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

interface QueueJob {
  msg_id: number;
  message: {
    module: string;
    version: string;
    author: string;
    inputs: {
      cpu: number | null;
      ram: number | null;
    };
  };
}

async function processQueue() {
  while (true) {
    console.log("🔄 Checking queue...");

    const { data, error } = await supabase.rpc("read_from_queue", {
      queue_name: queueName,
      vt: 30,
      qty: 1,
    });

    if (error) {
      console.error("❌ Queue error:", error);
      await delay(5000);
      continue;
    }

    if (!data || data.length === 0) {
      console.log("⏳ No jobs found, retrying in 5 seconds...");
      await delay(5000);
      continue;
    }

    for (const job of data as QueueJob[]) {
      console.log("🛠️ Processing job:", job.message);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        // Fetch user profile data
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("credit_balance, wallet")
          .eq("id", job.message.author)
          .single(); // single() to avoid unnecessary array handling

        if (profileError || !profileData) {
          console.error(
            `❌ Failed to fetch profile data for author ${job.message.author}:`,
            profileError,
          );
          continue;
        }

        console.log("🔑 Wallet Private Key:", profileData.wallet?.privateKey);

        if (profileData.credit_balance <= 0 && profileData.wallet?.privateKey) {
          // headers.Authorization = `Bearer ${profileData.wallet.privateKey}`; //FIXME: pipeline failing
          console.log("🔑 Authorization header set");
        }

        // Send request to API
        const response = await fetch(`${process.env.API_URL}/darts`, {
          method: "POST",
          headers,
          body: JSON.stringify(job.message),
        });

        if (!response.ok) {
          const responseText = await response.text();
          console.error(
            `❌ API request failed (Job ${job.msg_id}):`,
            response.status,
            responseText,
          );
          continue;
        }

        console.log(
          `✅ API call succeeded (Job ${job.msg_id}):`,
          await response.json(),
        );

        // Acknowledge and delete job ONLY if API call succeeds
        const { error: deleteError } = await supabase.rpc("delete_from_queue", {
          queue_name: queueName,
          msg_id: job.msg_id,
        });

        if (deleteError) {
          console.error(
            `❌ Error acknowledging job (Job ${job.msg_id}):`,
            deleteError,
          );
        } else {
          console.log(`✅ Job processed and removed from queue: ${job.msg_id}`);
        }
      } catch (err) {
        console.error(`❌ Error processing job (Job ${job.msg_id}):`, err);
      }
    }
  }
}

// Utility function for delays
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Start the worker
processQueue();
