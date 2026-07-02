import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const shouldLogQueries = process.env.PRISMA_QUERY_LOGS === "true";

const adapter = new PrismaPg(
  process.env.DATABASE_URL ??
    "postgresql://scanner:scanner@localhost:55432/website_scanner?schema=public",
);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? shouldLogQueries
          ? ["query", "error", "warn"]
          : ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
