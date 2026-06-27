import { Worker } from "bullmq";
import {
  getRedisConnection,
  SCAN_QUEUE_NAME,
  type ScanJobData,
} from "@/lib/jobs/queue";
import { processScan } from "@/lib/scanners/runner";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is required to run the scan worker.");
}

const worker = new Worker<ScanJobData, void, "scan-url-list">(
  SCAN_QUEUE_NAME,
  async (job) => {
    await processScan(job.data.scanId);
  },
  { connection: getRedisConnection() },
);

worker.on("completed", (job) => {
  console.log(`Scan job ${job.id} completed.`);
});

worker.on("failed", (job, error) => {
  console.error(`Scan job ${job?.id ?? "unknown"} failed.`, error);
});
