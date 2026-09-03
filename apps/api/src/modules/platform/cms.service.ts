import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BannerPlacement,
  CmsPageKind,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { uploadToCloudinary } from "../../lib/cloudinary";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
const MEDIA_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "video/mp4",
]);

type MetaInput = {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
};

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function assertSlug(slug: string) {
  if (!slug || !SLUG_RE.test(slug)) {
    throw new BadRequestException("slug must be lowercase kebab-case");
  }
}

function str(value: unknown) {
  if (value == null) return undefined;
  const next = String(value).trim();
  return next || undefined;
}

function bool(value: unknown) {
  if (value == null) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return Boolean(value);
}

function int(value: unknown, fallback?: number) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function date(value: unknown) {
  if (value == null || value === "") return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new BadRequestException("invalid date");
  return d;
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "Date not available";
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function requireMeta(published: boolean, title?: string | null, description?: string | null) {
  if (!published) return;
  if (!title?.trim() || !description?.trim()) {
    throw new BadRequestException("published content requires meta title and description");
  }
}

function presentPage(
  page: Prisma.CmsPageGetPayload<{ include: { metadata: true } }>
) {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    body: page.body,
    excerpt: page.excerpt,
    kind: page.kind,
    sortOrder: page.sortOrder,
    published: page.published,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    metadata: page.metadata,
    seoTitle: page.metadata?.title ?? page.title,
    seoDescription: page.metadata?.description ?? page.excerpt ?? "",
    seoKeywords: page.metadata?.keywords ?? "",
    seoOgImage: page.metadata?.ogImage ?? "",
  };
}

function presentBlog(
  post: Prisma.BlogPostGetPayload<{ include: { category: true } }> & {
    comments?: Array<{
      id: string;
      name: string | null;
      email: string | null;
      body: string;
      approved: boolean;
      createdAt: Date;
      postId: string;
    }>;
  },
  opts: { comments?: boolean } = {}
) {
  const comments = opts.comments
    ? (post.comments ?? [])
        .filter((c) => c.approved)
        .map(presentComment)
    : undefined;
  const when = post.publishedAt ?? post.createdAt;
  return {
    id: post.id,
    slug: post.slug,
    urlSlug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    content: post.body,
    coverUrl: post.coverUrl,
    imageLink: post.coverUrl,
    imageBase64: null,
    author: post.author,
    published: post.published,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    formattedDate: formatDate(when),
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    seoTitle: post.metaTitle || post.title,
    seoDescription: post.metaDescription || post.excerpt || "",
    categoryId: post.categoryId,
    category: post.category?.slug ?? post.category?.name ?? null,
    categoryName: post.category?.name ?? null,
    comments,
  };
}

function presentComment(comment: {
  id: string;
  name: string | null;
  body: string;
  approved: boolean;
  createdAt: Date;
  postId: string;
  email?: string | null;
}) {
  return {
    id: comment.id,
    postId: comment.postId,
    name: comment.name || "Guest",
    email: comment.email ?? null,
    body: comment.body,
    comment: comment.body,
    approved: comment.approved,
    createdAt: comment.createdAt,
  };
}

function presentTestimonial(row: {
  id: string;
  name: string;
  body: string;
  city: string | null;
  rating: number;
  photoUrl: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    message: row.body,
    city: row.city,
    rating: row.rating,
    photoUrl: row.photoUrl,
    image: row.photoUrl,
    sortOrder: row.sortOrder,
    active: row.active,
    status: row.active ? "approved" : "pending",
    createdAt: row.createdAt,
  };
}

function presentBanner(row: {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string;
  link: string | null;
  ctaText: string | null;
  placement: BannerPlacement;
  startsAt: Date | null;
  endsAt: Date | null;
  sortOrder: number;
  active: boolean;
}) {
  return row;
}

function presentCategory(row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    seoTitle: row.metaTitle || row.name,
    seoDescription: row.metaDescription || row.description || "",
  };
}

@Injectable()
export class CmsService {
  publicConfig() {
    return {
      siteName: process.env.PUBLIC_SITE_NAME || "Dream Drive",
      phone: process.env.PUBLIC_PHONE || "+91-994-202-7772",
      whatsapp: process.env.PUBLIC_WHATSAPP || "919942027772",
      email: process.env.PUBLIC_EMAIL || "Dreamdrive1818@gmail.com",
      address:
        process.env.PUBLIC_ADDRESS ||
        "105 Jagriti Bhawan, near Adarsh Nagar, Bariatu, Ranchi - 834009 Jharkhand",
    };
  }

  async home() {
    const now = new Date();
    const [page, banners, blogs, testimonials, fleet] = await Promise.all([
      prisma.cmsPage.findFirst({
        where: { slug: "home", published: true },
        include: { metadata: true },
      }),
      this.activeBanners(now),
      prisma.blogPost.findMany({
        where: { published: true },
        include: { category: true },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 3,
      }),
      prisma.testimonial.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 8,
      }),
      prisma.carModel.findMany({
        where: { published: true, featured: true },
        include: { images: { orderBy: { sortOrder: "asc" } }, pricingRules: true, city: true },
        orderBy: { displayOrder: "asc" },
        take: 8,
      }),
    ]);
    return {
      page: page ? presentPage(page) : null,
      banners: {
        hero: banners.filter((b) => b.placement === "HERO"),
        strip: banners.filter((b) => b.placement === "STRIP"),
        promo: banners.filter((b) => b.placement === "HOME_PROMO"),
        side: banners.filter((b) => b.placement === "SIDE"),
      },
      blogs: blogs.map((b) => presentBlog(b)),
      testimonials: testimonials.map(presentTestimonial),
      fleet: fleet.map((car) => ({
        id: car.id,
        slug: car.slug,
        name: car.name,
        type: car.type,
        seats: car.seats,
        fuel: car.fuel,
        transmission: car.transmission,
        city: car.city,
        images: car.images.map((img) => img.url),
        pricePaise: car.pricingRules[0]?.dailyPaise ?? 0,
      })),
      config: this.publicConfig(),
    };
  }

  async publicPages(kind?: string) {
    const rows = await prisma.cmsPage.findMany({
      where: {
        published: true,
        kind: kind && kind in CmsPageKind ? (kind as CmsPageKind) : undefined,
      },
      include: { metadata: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
    return rows.map(presentPage);
  }

  async publicPage(slug: string) {
    const page = await prisma.cmsPage.findFirst({
      where: { slug, published: true },
      include: { metadata: true },
    });
    if (!page) throw new NotFoundException("Page not found");
    return presentPage(page);
  }

  async banners(placement?: string) {
    const rows = await this.activeBanners(new Date(), placement);
    return rows.map(presentBanner);
  }

  private activeBanners(now: Date, placement?: string) {
    return prisma.banner.findMany({
      where: {
        active: true,
        placement:
          placement && placement in BannerPlacement
            ? (placement as BannerPlacement)
            : undefined,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async blogs(query: { category?: string; take?: number }) {
    const take = Math.min(Math.max(query.take ?? 50, 1), 100);
    const categoryFilter = query.category
      ? {
          OR: [
            { slug: query.category },
            { id: query.category },
            { name: { equals: query.category, mode: "insensitive" as const } },
          ],
        }
      : undefined;
    const rows = await prisma.blogPost.findMany({
      where: {
        published: true,
        category: categoryFilter,
      },
      include: { category: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take,
    });
    return rows.map((row) => presentBlog(row));
  }

  async blog(slug: string) {
    const post = await prisma.blogPost.findFirst({
      where: { slug, published: true },
      include: { category: true, comments: { orderBy: { createdAt: "desc" } } },
    });
    if (!post) throw new NotFoundException("Blog not found");
    return presentBlog(post, { comments: true });
  }

  async categories() {
    const rows = await prisma.blogCategory.findMany({ orderBy: { name: "asc" } });
    return rows.map(presentCategory);
  }

  async category(idOrSlug: string) {
    const row = await prisma.blogCategory.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!row) throw new NotFoundException("Category not found");
    return presentCategory(row);
  }

  async commentsForPost(idOrSlug: string) {
    const post = await prisma.blogPost.findFirst({
      where: { published: true, OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
    });
    if (!post) throw new NotFoundException("Blog not found");
    const rows = await prisma.blogComment.findMany({
      where: { postId: post.id, approved: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(presentComment);
  }

  async createComment(
    slug: string,
    body: { name?: string; email?: string; comment?: string; body?: string },
    user?: { id: string; email: string } | null
  ) {
    const post = await prisma.blogPost.findFirst({
      where: { published: true, OR: [{ slug }, { id: slug }] },
    });
    if (!post) throw new NotFoundException("Blog not found");
    const text = str(body.body ?? body.comment);
    if (!text) throw new BadRequestException("comment required");
    let name = str(body.name);
    if (user) {
      const profile = await prisma.customerProfile.findUnique({
        where: { userId: user.id },
      });
      name = name || profile?.fullName || user.email.split("@")[0];
    }
    if (!name) throw new BadRequestException("name required unless signed in");
    const row = await prisma.blogComment.create({
      data: {
        postId: post.id,
        userId: user?.id,
        name,
        email: str(body.email) || user?.email,
        body: text,
        approved: false,
      },
    });
    return { ...presentComment(row), pending: true };
  }

  async testimonials() {
    const rows = await prisma.testimonial.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(presentTestimonial);
  }

  async submitTestimonial(body: {
    name?: string;
    message?: string;
    body?: string;
    rating?: number;
    image?: string;
    photoUrl?: string;
    city?: string;
  }) {
    const name = str(body.name);
    const text = str(body.body ?? body.message);
    if (!name || !text) throw new BadRequestException("name and message required");
    const rating = int(body.rating, 5) ?? 5;
    if (rating < 1 || rating > 5) throw new BadRequestException("rating must be 1–5");
    const row = await prisma.testimonial.create({
      data: {
        name,
        body: text,
        city: str(body.city),
        rating,
        photoUrl: str(body.photoUrl ?? body.image),
        active: false,
      },
    });
    return { ...presentTestimonial(row), pending: true };
  }

  async contact(body: {
    name?: string;
    first?: string;
    last?: string;
    email?: string;
    phone?: string;
    message?: string;
    city?: string;
    source?: string;
  }) {
    const name =
      str(body.name) ||
      [str(body.first), str(body.last)].filter(Boolean).join(" ");
    const email = str(body.email)?.toLowerCase();
    const phone = str(body.phone);
    if (!name) throw new BadRequestException("name required");
    if (!email && !phone) throw new BadRequestException("email or phone required");
    return this.upsertLead({
      name,
      email,
      phone,
      city: str(body.city),
      source: str(body.source) || "contact",
      note: str(body.message),
    });
  }

  async createLead(body: {
    name?: string;
    email?: string;
    phone?: string;
    source?: string;
    city?: string;
    message?: string;
  }) {
    const name = str(body.name) || "Website enquiry";
    const email = str(body.email)?.toLowerCase();
    const phone = str(body.phone);
    if (!email && !phone) throw new BadRequestException("email or phone required");
    return this.upsertLead({
      name,
      email,
      phone,
      city: str(body.city),
      source: str(body.source) || "web",
      note: str(body.message),
    });
  }

  private async upsertLead(input: {
    name: string;
    email?: string;
    phone?: string;
    city?: string;
    source: string;
    note?: string;
  }) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const existing = await prisma.lead.findFirst({
      where: {
        createdAt: { gte: since },
        OR: [
          input.email ? { email: input.email } : undefined,
          input.phone ? { phone: input.phone } : undefined,
        ].filter(Boolean) as Prisma.LeadWhereInput[],
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      if (input.note) {
        await prisma.leadActivity.create({
          data: { leadId: existing.id, note: input.note },
        });
      }
      return { id: existing.id, duplicate: true, status: existing.status };
    }
    const lead = await prisma.lead.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        city: input.city,
        source: input.source,
        activities: input.note ? { create: { note: input.note } } : undefined,
      },
    });
    return { id: lead.id, duplicate: false, status: lead.status };
  }

  listPages() {
    return prisma.cmsPage.findMany({
      include: { metadata: true },
      orderBy: [{ kind: "asc" }, { slug: "asc" }],
    });
  }

  async getPage(id: string) {
    const page = await prisma.cmsPage.findUnique({
      where: { id },
      include: { metadata: true },
    });
    if (!page) throw new NotFoundException("Page not found");
    return presentPage(page);
  }

  async upsertPage(body: Record<string, unknown>, actorId?: string) {
    const slug = slugify(String(body.slug ?? body.title ?? ""));
    assertSlug(slug);
    const title = str(body.title);
    const pageBody = body.body != null ? String(body.body) : undefined;
    if (!title) throw new BadRequestException("title required");
    const published = bool(body.published) ?? false;
    const meta = (body.metadata as MetaInput | undefined) ?? {
      title: str(body.metaTitle),
      description: str(body.metaDescription),
    };
    if (published) {
      const existing = await prisma.cmsPage.findUnique({
        where: { slug },
        include: { metadata: true },
      });
      requireMeta(
        true,
        meta.title || existing?.metadata?.title,
        meta.description || existing?.metadata?.description
      );
    }
    const kind =
      body.kind && String(body.kind) in CmsPageKind
        ? (body.kind as CmsPageKind)
        : CmsPageKind.CUSTOM;
    const page = await prisma.cmsPage.upsert({
      where: { slug },
      create: {
        slug,
        title,
        body: pageBody ?? "",
        excerpt: str(body.excerpt),
        kind,
        sortOrder: int(body.sortOrder, 0) ?? 0,
        published,
      },
      update: {
        title,
        body: pageBody,
        excerpt: str(body.excerpt),
        kind,
        sortOrder: int(body.sortOrder),
        published,
      },
    });
    if (meta.title && meta.description) {
      await this.saveMetadata(page.id, meta);
    }
    await this.audit(actorId, "cms.page.upsert", page.id, { slug, published });
    return this.getPage(page.id);
  }

  async updatePage(id: string, body: Record<string, unknown>, actorId?: string) {
    const existing = await prisma.cmsPage.findUnique({
      where: { id },
      include: { metadata: true },
    });
    if (!existing) throw new NotFoundException("Page not found");
    const slug = body.slug ? slugify(String(body.slug)) : existing.slug;
    assertSlug(slug);
    const published = bool(body.published) ?? existing.published;
    const meta = (body.metadata as MetaInput | undefined) ?? {
      title: str(body.metaTitle) || existing.metadata?.title,
      description: str(body.metaDescription) || existing.metadata?.description,
    };
    requireMeta(published, meta.title, meta.description);
    if (slug !== existing.slug) {
      const clash = await prisma.cmsPage.findUnique({ where: { slug } });
      if (clash) throw new BadRequestException("slug already in use");
    }
    await prisma.cmsPage.update({
      where: { id },
      data: {
        slug,
        title: str(body.title) ?? existing.title,
        body: body.body != null ? String(body.body) : undefined,
        excerpt: str(body.excerpt),
        kind:
          body.kind && String(body.kind) in CmsPageKind
            ? (body.kind as CmsPageKind)
            : undefined,
        sortOrder: int(body.sortOrder),
        published,
      },
    });
    if (meta.title && meta.description) await this.saveMetadata(id, meta);
    await this.audit(actorId, "cms.page.update", id, { slug, published });
    return this.getPage(id);
  }

  async deletePage(id: string, actorId?: string) {
    await prisma.cmsPage.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Page not found");
    });
    await this.audit(actorId, "cms.page.delete", id);
    return { ok: true };
  }

  async saveMetadata(pageId: string, meta: MetaInput) {
    const title = str(meta.title);
    const description = str(meta.description);
    if (!title || !description) {
      throw new BadRequestException("meta title and description required");
    }
    return prisma.pageMetadata.upsert({
      where: { pageId },
      create: {
        pageId,
        title,
        description,
        keywords: str(meta.keywords),
        ogImage: str(meta.ogImage),
      },
      update: {
        title,
        description,
        keywords: str(meta.keywords),
        ogImage: str(meta.ogImage),
      },
    });
  }

  adminBanners() {
    return prisma.banner.findMany({
      orderBy: [{ placement: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async createBanner(body: Record<string, unknown>, actorId?: string) {
    const title = str(body.title);
    const imageUrl = str(body.imageUrl);
    if (!title || !imageUrl) throw new BadRequestException("title and imageUrl required");
    const row = await prisma.banner.create({
      data: {
        title,
        body: str(body.body),
        imageUrl,
        link: str(body.link),
        ctaText: str(body.ctaText),
        placement:
          body.placement && String(body.placement) in BannerPlacement
            ? (body.placement as BannerPlacement)
            : BannerPlacement.HERO,
        startsAt: date(body.startsAt) ?? null,
        endsAt: date(body.endsAt) ?? null,
        sortOrder: int(body.sortOrder, 0) ?? 0,
        active: bool(body.active) ?? true,
      },
    });
    await this.audit(actorId, "cms.banner.create", row.id);
    return row;
  }

  async updateBanner(id: string, body: Record<string, unknown>, actorId?: string) {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Banner not found");
    const row = await prisma.banner.update({
      where: { id },
      data: {
        title: str(body.title),
        body: str(body.body),
        imageUrl: str(body.imageUrl),
        link: str(body.link),
        ctaText: str(body.ctaText),
        placement:
          body.placement && String(body.placement) in BannerPlacement
            ? (body.placement as BannerPlacement)
            : undefined,
        startsAt: body.startsAt !== undefined ? date(body.startsAt) ?? null : undefined,
        endsAt: body.endsAt !== undefined ? date(body.endsAt) ?? null : undefined,
        sortOrder: int(body.sortOrder),
        active: bool(body.active),
      },
    });
    await this.audit(actorId, "cms.banner.update", id);
    return row;
  }

  async deleteBanner(id: string, actorId?: string) {
    await prisma.banner.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Banner not found");
    });
    await this.audit(actorId, "cms.banner.delete", id);
    return { ok: true };
  }

  adminBlogs() {
    return prisma.blogPost.findMany({
      include: { category: true, comments: true },
      orderBy: { createdAt: "desc" },
    }).then((rows) =>
      rows.map((row) => ({
        ...presentBlog(row),
        commentCount: row.comments.length,
        pendingComments: row.comments.filter((c) => !c.approved).length,
      }))
    );
  }

  async createBlog(body: Record<string, unknown>, actorId?: string) {
    const title = str(body.title);
    const pageBody = String(body.body ?? body.content ?? "");
    if (!title) throw new BadRequestException("title required");
    const slug = slugify(String(body.slug ?? body.urlSlug ?? title));
    assertSlug(slug);
    const clash = await prisma.blogPost.findUnique({ where: { slug } });
    if (clash) throw new BadRequestException("slug already in use");
    const published = bool(body.published) ?? false;
    const metaTitle = str(body.metaTitle ?? body.seoTitle) || (published ? title : undefined);
    const metaDescription =
      str(body.metaDescription ?? body.seoDescription) ||
      str(body.excerpt) ||
      pageBody.replace(/<[^>]+>/g, "").slice(0, 160);
    requireMeta(published, metaTitle, metaDescription);
    const categoryId = await this.resolveCategoryId(body.categoryId ?? body.category);
    const row = await prisma.blogPost.create({
      data: {
        slug,
        title,
        excerpt: str(body.excerpt) || metaDescription?.slice(0, 180),
        body: pageBody,
        coverUrl: str(body.coverUrl ?? body.imageLink),
        author: str(body.author),
        published,
        publishedAt: published ? date(body.publishedAt) ?? new Date() : null,
        metaTitle,
        metaDescription,
        categoryId,
      },
      include: { category: true },
    });
    await this.audit(actorId, "cms.blog.create", row.id, { slug, published });
    return presentBlog(row);
  }

  async updateBlog(id: string, body: Record<string, unknown>, actorId?: string) {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Blog not found");
    const slug = body.slug || body.urlSlug ? slugify(String(body.slug ?? body.urlSlug)) : existing.slug;
    assertSlug(slug);
    if (slug !== existing.slug) {
      const clash = await prisma.blogPost.findUnique({ where: { slug } });
      if (clash) throw new BadRequestException("slug already in use");
    }
    const published = bool(body.published) ?? existing.published;
    const metaTitle = str(body.metaTitle ?? body.seoTitle) || existing.metaTitle || existing.title;
    const metaDescription =
      str(body.metaDescription ?? body.seoDescription) ||
      existing.metaDescription ||
      existing.excerpt;
    requireMeta(published, metaTitle, metaDescription);
    const categoryId =
      body.categoryId !== undefined || body.category !== undefined
        ? await this.resolveCategoryId(body.categoryId ?? body.category)
        : undefined;
    const row = await prisma.blogPost.update({
      where: { id },
      data: {
        slug,
        title: str(body.title),
        excerpt: str(body.excerpt),
        body: body.body != null || body.content != null ? String(body.body ?? body.content) : undefined,
        coverUrl: str(body.coverUrl ?? body.imageLink),
        author: str(body.author),
        published,
        publishedAt: published
          ? existing.publishedAt ?? date(body.publishedAt) ?? new Date()
          : null,
        metaTitle,
        metaDescription,
        categoryId,
      },
      include: { category: true },
    });
    await this.audit(actorId, "cms.blog.update", id, { slug, published });
    return presentBlog(row);
  }

  async deleteBlog(id: string, actorId?: string) {
    await prisma.blogPost.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Blog not found");
    });
    await this.audit(actorId, "cms.blog.delete", id);
    return { ok: true };
  }

  private async resolveCategoryId(value: unknown) {
    if (value == null || value === "") return null;
    const raw = String(value);
    const found = await prisma.blogCategory.findFirst({
      where: { OR: [{ id: raw }, { slug: raw }, { name: raw }] },
    });
    return found?.id ?? null;
  }

  async createCategory(body: Record<string, unknown>, actorId?: string) {
    const name = str(body.name);
    if (!name) throw new BadRequestException("name required");
    const slug = slugify(String(body.slug ?? name));
    assertSlug(slug);
    const row = await prisma.blogCategory.create({
      data: {
        name,
        slug,
        description: str(body.description),
        metaTitle: str(body.metaTitle ?? body.seoTitle),
        metaDescription: str(body.metaDescription ?? body.seoDescription),
      },
    });
    await this.audit(actorId, "cms.category.create", row.id);
    return presentCategory(row);
  }

  async updateCategory(id: string, body: Record<string, unknown>, actorId?: string) {
    const existing = await prisma.blogCategory.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!existing) throw new NotFoundException("Category not found");
    const name = str(body.name) || existing.name;
    const slug =
      body.slug || body.name
        ? slugify(String(body.slug ?? body.name ?? existing.slug))
        : existing.slug;
    assertSlug(slug);
    const row = await prisma.blogCategory.update({
      where: { id: existing.id },
      data: {
        name,
        slug,
        description: str(body.description),
        metaTitle: str(body.metaTitle ?? body.seoTitle),
        metaDescription: str(body.metaDescription ?? body.seoDescription),
      },
    });
    await this.audit(actorId, "cms.category.update", row.id);
    return presentCategory(row);
  }

  async deleteCategory(id: string, actorId?: string) {
    const existing = await prisma.blogCategory.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!existing) throw new NotFoundException("Category not found");
    await prisma.blogCategory.delete({ where: { id: existing.id } });
    await this.audit(actorId, "cms.category.delete", existing.id);
    return { ok: true };
  }

  async adminComments(approved?: string) {
    const rows = await prisma.blogComment.findMany({
      where:
        approved === "true"
          ? { approved: true }
          : approved === "false"
            ? { approved: false }
            : undefined,
      include: { post: { select: { id: true, title: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => ({
      ...presentComment(row),
      postTitle: row.post.title,
      postSlug: row.post.slug,
    }));
  }

  async setCommentApproved(id: string, approved: boolean, actorId?: string) {
    const row = await prisma.blogComment.update({
      where: { id },
      data: { approved },
    }).catch(() => {
      throw new NotFoundException("Comment not found");
    });
    await this.audit(actorId, "cms.comment.moderate", id, { approved });
    return presentComment(row);
  }

  async deleteComment(id: string, actorId?: string) {
    await prisma.blogComment.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Comment not found");
    });
    await this.audit(actorId, "cms.comment.delete", id);
    return { ok: true };
  }

  async listMedia() {
    return prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  }

  async createMedia(
    body: { url?: string; filename?: string; mimeType?: string; sizeBytes?: number; category?: string },
    file?: { buffer?: Buffer; originalname?: string; mimetype?: string; size?: number },
    actorId?: string
  ) {
    let url = str(body.url);
    let mimeType = str(body.mimeType) || file?.mimetype || "application/octet-stream";
    let sizeBytes = int(body.sizeBytes, file?.size ?? 0) ?? 0;
    let filename = str(body.filename) || file?.originalname;
    if (file?.buffer?.length) {
      this.assertMedia(file.mimetype, file.size ?? file.buffer.length);
      const uploaded = await uploadToCloudinary({
        folder: "dreamdrive/cms",
        buffer: file.buffer,
        filename: file.originalname,
        mimetype: file.mimetype,
      });
      url = uploaded.url;
      mimeType = file.mimetype || mimeType;
      sizeBytes = file.size ?? file.buffer.length;
      filename = file.originalname || filename;
    }
    if (!url) throw new BadRequestException("url or file required");
    if (!file && (!mimeType || mimeType === "application/octet-stream")) {
      mimeType = this.mimeFromUrl(url);
    }
    this.assertMedia(mimeType, sizeBytes);
    const row = await prisma.mediaAsset.create({
      data: {
        url,
        filename,
        mimeType,
        sizeBytes,
        category: str(body.category) || "cms",
      },
    });
    await this.audit(actorId, "cms.media.create", row.id);
    return row;
  }

  async deleteMedia(id: string, actorId?: string) {
    await prisma.mediaAsset.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Media not found");
    });
    await this.audit(actorId, "cms.media.delete", id);
    return { ok: true };
  }

  private mimeFromUrl(url: string) {
    const lower = url.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".svg")) return "image/svg+xml";
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".mp4")) return "video/mp4";
    return "image/jpeg";
  }

  private assertMedia(mimeType?: string, sizeBytes?: number) {
    if (sizeBytes != null && sizeBytes > MEDIA_MAX_BYTES) {
      throw new BadRequestException("file exceeds 8 MB limit");
    }
    if (mimeType && !MEDIA_MIME.has(mimeType)) {
      throw new BadRequestException("unsupported media type");
    }
  }

  adminTestimonials() {
    return prisma.testimonial.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }).then((rows) => rows.map(presentTestimonial));
  }

  async createTestimonial(body: Record<string, unknown>, actorId?: string) {
    const name = str(body.name);
    const text = str(body.body ?? body.message);
    if (!name || !text) throw new BadRequestException("name and body required");
    const rating = int(body.rating, 5) ?? 5;
    if (rating < 1 || rating > 5) throw new BadRequestException("rating must be 1–5");
    const row = await prisma.testimonial.create({
      data: {
        name,
        body: text,
        city: str(body.city),
        rating,
        photoUrl: str(body.photoUrl ?? body.image),
        sortOrder: int(body.sortOrder, 0) ?? 0,
        active:
          bool(body.active) ??
          (body.status === "pending" ? false : body.status === "approved" ? true : true),
      },
    });
    await this.audit(actorId, "cms.testimonial.create", row.id);
    return presentTestimonial(row);
  }

  async updateTestimonial(id: string, body: Record<string, unknown>, actorId?: string) {
    const existing = await prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Testimonial not found");
    const active =
      body.status === "approved"
        ? true
        : body.status === "pending"
          ? false
          : bool(body.active);
    const row = await prisma.testimonial.update({
      where: { id },
      data: {
        name: str(body.name),
        body: str(body.body ?? body.message),
        city: str(body.city),
        rating: int(body.rating),
        photoUrl: str(body.photoUrl ?? body.image),
        sortOrder: int(body.sortOrder),
        active,
      },
    });
    await this.audit(actorId, "cms.testimonial.update", id);
    return presentTestimonial(row);
  }

  async deleteTestimonial(id: string, actorId?: string) {
    await prisma.testimonial.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Testimonial not found");
    });
    await this.audit(actorId, "cms.testimonial.delete", id);
    return { ok: true };
  }

  private async audit(
    actorId: string | undefined,
    action: string,
    entityId?: string,
    payload?: Prisma.InputJsonValue
  ) {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity: "Cms",
        entityId,
        payload,
      },
    });
  }
}
