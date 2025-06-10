import { QueueService } from "./services/queue.service"
import { ProfileService } from "./services/profile.service"
import { TokenService } from "./services/token.service"
import { ApiService } from "./services/api.service"
import Bluebird from "bluebird"

import cliProgress from "cli-progress"

import { QueueJob } from "./index.d"

async function processJob(job: QueueJob): Promise<void> {
  try {
    const profile = await ProfileService.getProfile(job.message.author)

    if (!profile.wallet?.privateKey) {
      throw new Error("Custodial Wallet not found for user", job.message.author)
    }

    await Promise.all([
      TokenService.handleTokenTransfer(job, profile.wallet.privateKey),
      ApiService.processJob(job)
    ])
    await QueueService.deleteJob(job.msg_id)
  } catch (error) {
    console.error(`❌ Error processing job ${job.msg_id}:`, error)
  }
}

// Initialize progress bar with custom formatting
const progressBar = new cliProgress.SingleBar(
  {
    format:'{processed} jobs | Avg: {avg}s | Last: {current}s | Elapsed: {duration_formatted}',

    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
    clearOnComplete: false,
  },
  cliProgress.Presets.shades_classic
)

const bar = new cliProgress.SingleBar({
  format: 'progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

// Processing statistics
let processedJobs = 0
let totalProcessingTime = 0
const processingTimes: number[] = []

export async function processQueue() {
  progressBar.start(0, 0, {
    processed: processedJobs,
    avg: Math.round(totalProcessingTime / processingTimes.length),
    current: 0,
  })

  // bar.start(0,0,{})

  try {
    while (true) {
      const jobs = await QueueService.fetchJobs(4)

      if (jobs.length === 0) {
        await Bluebird.delay(5000)
        continue
      }

      // Process jobs with individual timing
      await Promise.all(
        jobs.map(async (job) => {
          const start = Date.now()
          console.log()

          try {
            await processJob(job)
            const duration = Date.now() - start

            // Update statistics
            processingTimes.push(duration)
            totalProcessingTime += duration
            processedJobs++

            // Maintain rolling window of last 100 jobs
            if (processingTimes.length > 100) {
              totalProcessingTime -= processingTimes.shift()!
            }

            // Update progress bar
            progressBar.update(processedJobs, {
              processed: processedJobs,
              avg: Math.round(totalProcessingTime / processingTimes.length)/1000,
              current: duration/1000,
            })
            // bar.increment(1)
          } catch (error) {
            console.error(`Job ${job.msg_id} failed:`, error)
          }
        })
      )
    }
  } finally {
    progressBar.stop()
    bar.stop()
  }
}

processQueue()
