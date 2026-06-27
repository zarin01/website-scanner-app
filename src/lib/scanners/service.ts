import { prisma } from "@/lib/db/prisma";
import { hasDatabaseUrl } from "@/lib/env";
import { getScanQueue } from "@/lib/jobs/queue";
import { processScanInBackground } from "@/lib/scanners/runner";
import type { ScanRequestInput } from "@/lib/validation/scan";

const DEFAULT_ORGANIZATION = {
  name: "Webdev Agency",
  slug: "webdev-agency",
};

export class SetupRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupRequiredError";
  }
}

export async function createScanRequest(input: ScanRequestInput) {
  if (!hasDatabaseUrl()) {
    throw new SetupRequiredError("DATABASE_URL is not configured.");
  }

  const organization = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORGANIZATION.slug },
    update: {},
    create: DEFAULT_ORGANIZATION,
  });

  const client = input.clientName
    ? await prisma.client.upsert({
        where: {
          organizationId_name: {
            organizationId: organization.id,
            name: input.clientName,
          },
        },
        update: {},
        create: {
          name: input.clientName,
          organizationId: organization.id,
        },
      })
    : null;

  const project = input.projectName
    ? await prisma.project.create({
        data: {
          name: input.projectName,
          rootUrl: input.urls[0],
          organizationId: organization.id,
          clientId: client?.id,
        },
      })
    : null;

  const scan = await prisma.scan.create({
    data: {
      organizationId: organization.id,
      projectId: project?.id,
      requestedUrls: input.urls,
      config: {
        includeSubpages: input.includeSubpages,
        maxPages: input.maxPages,
        notes: input.notes,
      },
      urls: {
        create: input.urls.map((url) => ({
          url,
          normalizedUrl: url,
        })),
      },
    },
    include: {
      urls: true,
    },
  });

  const queue = getScanQueue();

  if (queue) {
    await queue.add("scan-url-list", {
      scanId: scan.id,
      urls: input.urls,
    });
  } else {
    processScanInBackground(scan.id);
  }

  return {
    id: scan.id,
    status: scan.status,
    queuedUrlCount: scan.urls.length,
    workerQueued: Boolean(queue),
  };
}
