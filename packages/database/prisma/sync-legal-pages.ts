/**
 * Upserts canonical legal CMS pages without running the full seed.
 * Usage: npx tsx prisma/sync-legal-pages.ts  (from packages/database)
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  LEGAL_CONTENT_VERSION,
  LEGAL_PAGES,
} from "../../../apps/api/src/modules/platform/legal-pages";

const prisma = new PrismaClient();

async function main() {
  for (const page of LEGAL_PAGES) {
    const row = await prisma.cmsPage.upsert({
      where: { slug: page.slug },
      update: {
        title: page.title,
        excerpt: page.excerpt,
        body: page.body,
        kind: "LEGAL",
        published: true,
        sortOrder: page.sortOrder,
      },
      create: {
        slug: page.slug,
        title: page.title,
        excerpt: page.excerpt,
        body: page.body,
        kind: "LEGAL",
        published: true,
        sortOrder: page.sortOrder,
      },
    });
    await prisma.pageMetadata.upsert({
      where: { pageId: row.id },
      update: {
        title: page.metaTitle,
        description: page.metaDescription,
      },
      create: {
        pageId: row.id,
        title: page.metaTitle,
        description: page.metaDescription,
      },
    });
    console.log(`Upserted /legal/${page.slug} (${page.title})`);
  }

  await prisma.siteSetting.upsert({
    where: { key: "legalContentVersion" },
    update: {
      value: LEGAL_CONTENT_VERSION,
      label: "Legal CMS content version",
      group: "content",
    },
    create: {
      key: "legalContentVersion",
      value: LEGAL_CONTENT_VERSION,
      label: "Legal CMS content version",
      group: "content",
    },
  });
  console.log(`legalContentVersion = ${LEGAL_CONTENT_VERSION}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
