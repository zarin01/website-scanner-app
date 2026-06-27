import { Queue, type ConnectionOptions } from "bullmq";
import { hasRedisUrl } from "@/lib/env";

export const SCAN_QUEUE_NAME = "website-scans";

export type ScanJobData = {
  scanId: string;
  urls: string[];
};

const globalForQueue = globalThis as unknown as {
  scanQueue?: Queue<ScanJobData, void, "scan-url-list">;
};

export function getRedisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL!);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number(url.pathname.replace("/", "") || 0),
  };
}

export function getScanQueue() {
  if (!hasRedisUrl()) {
    return null;
  }

  if (!globalForQueue.scanQueue) {
    globalForQueue.scanQueue = new Queue<ScanJobData, void, "scan-url-list">(
      SCAN_QUEUE_NAME,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      },
    );
  }

  return globalForQueue.scanQueue;
}
