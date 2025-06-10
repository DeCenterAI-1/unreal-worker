import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { transferUnrealTokens } from "./tokenTransfer";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const queueName = process.env.QUEUE_NAME as string;
const funderPrivateKey = process.env.FUNDER_PRIVATE_KEY as string;

const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

// Track jobs that have already had tokens transferred to prevent duplicate transfers
const processedTokenTransfers = new Set<string>();

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
    tokenTransactions?: {
      funderToWalletTxHash: string;
      walletToClientTxHash: string;
    };
  };
}

async function processQueue() {
  while (true) {
    console.log("🔄 Checking queue...");

    const { data, error } = await supabase.rpc("read_from_queue", {
      queue_name: queueName,
      vt: 30, // Visibility timeout (seconds)
      qty: 1, // Number of messages to fetch
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
            profileError
          );
          continue; // Skip processing if profile data is unavailable
        }

        console.log("🔑 Wallet Private Key:", profileData.wallet?.privateKey);

        if (profileData.wallet?.privateKey) {
          // Check if we've already processed a token transfer for this job
          const jobKey = `${job.msg_id}`;
          
          if (!processedTokenTransfers.has(jobKey)) {
            try {
              // Execute the token transfer flow before making the API call
              console.log(`🔄 Starting UNREAL token transfer flow for job ${job.msg_id}...`);
              const txResults = await transferUnrealTokens(
                funderPrivateKey,
                profileData.wallet.privateKey
              );

              console.log(
                `✅ Token transfer flow completed successfully for job ${job.msg_id}:`,
                txResults
              );

              // Add transaction hashes to the job message for tracking
              job.message = {
                ...job.message,
                tokenTransactions: txResults,
              };
              
              // Mark this job as having had tokens transferred
              processedTokenTransfers.add(jobKey);
            } catch (transferError) {
              console.error(`❌ Token transfer failed for job ${job.msg_id}:`, transferError);
              // Continue with the API call even if token transfer fails
              // This allows the system to still process the job without the token transfer
            }
          } else {
            console.log(`⏭️ Skipping token transfer for job ${job.msg_id} (already processed)`);
          }
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
            responseText
          );
          continue; // Don't delete the job, allow retry
        }

        console.log(
          `✅ API call succeeded (Job ${job.msg_id}):`,
          await response.json()
        );

        // Acknowledge and delete job ONLY if API call succeeds
        const { error: deleteError } = await supabase.rpc("delete_from_queue", {
          queue_name: queueName,
          msg_id: job.msg_id,
        });

        if (deleteError) {
          console.error(
            `❌ Error acknowledging job (Job ${job.msg_id}):`,
            deleteError
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
