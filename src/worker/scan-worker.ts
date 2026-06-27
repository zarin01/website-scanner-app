import { Worker } from "bullmq";
import {
  getRedisConnection,
  SCAN_QUEUE_NAME,
  type ScanJobData,
} from "@/lib/jobs/queue";
import { prisma } from "@/lib/db/prisma";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is required to run the scan worker.");
}

const worker = new Worker<ScanJobData, void, "scan-url-list">(
  SCAN_QUEUE_NAME,
  async (job) => {
    await prisma.scan.update({
      where: { id: job.data.scanId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    // Scanner adapters will be executed here in the next implementation pass.
    await prisma.scan.update({
      where: { id: job.data.scanId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        summary: {
          processedUrls: job.data.urls.length,
        },
      },
    });
  },
  { connection: getRedisConnection() },
);

worker.on("completed", (job) => {
  console.log(`Scan job ${job.id} completed.`);
});

worker.on("failed", (job, error) => {
  console.error(`Scan job ${job?.id ?? "unknown"} failed.`, error);
});
