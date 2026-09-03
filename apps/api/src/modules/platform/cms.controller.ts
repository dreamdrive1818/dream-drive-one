import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { CmsService } from "./cms.service";
import { optionalUser, requireRoles } from "../../lib/auth";

const fileInterceptor = FileInterceptor("file", {
  limits: { fileSize: 8 * 1024 * 1024 },
});

@Controller()
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get("v1/public/config")
  publicConfig() {
    return this.cms.publicConfig();
  }

  @Get("v1/public/home")
  home() {
    return this.cms.home();
  }

  @Get("v1/public/pages")
  publicPages(@Query("kind") kind?: string) {
    return this.cms.publicPages(kind);
  }

  @Get("v1/public/pages/:slug")
  publicPage(@Param("slug") slug: string) {
    return this.cms.publicPage(slug);
  }

  @Get("v1/public/banners")
  banners(@Query("placement") placement?: string) {
    return this.cms.banners(placement);
  }

  @Get("v1/public/blogs")
  blogs(@Query("category") category?: string, @Query("take") take?: string) {
    return this.cms.blogs({ category, take: take ? Number(take) : undefined });
  }

  @Get("v1/public/blogs/:slug")
  blog(@Param("slug") slug: string) {
    return this.cms.blog(slug);
  }

  @Get("v1/public/blogs/:slug/comments")
  blogComments(@Param("slug") slug: string) {
    return this.cms.commentsForPost(slug);
  }

  @Post("v1/public/blogs/:slug/comments")
  createComment(
    @Req() req: Request,
    @Param("slug") slug: string,
    @Body() body: { name?: string; email?: string; comment?: string; body?: string }
  ) {
    return this.cms.createComment(slug, body, optionalUser(req));
  }

  @Get("v1/public/blog-categories")
  categories() {
    return this.cms.categories();
  }

  @Get("v1/public/blog-categories/:id")
  category(@Param("id") id: string) {
    return this.cms.category(id);
  }

  @Get("v1/public/testimonials")
  testimonials() {
    return this.cms.testimonials();
  }

  @Post("v1/public/testimonials")
  submitTestimonial(@Body() body: Record<string, unknown>) {
    return this.cms.submitTestimonial(body);
  }

  @Post("v1/public/contact")
  contact(@Body() body: Record<string, unknown>) {
    return this.cms.contact(body);
  }

  @Post("v1/public/leads")
  publicLead(@Body() body: Record<string, unknown>) {
    return this.cms.createLead(body);
  }

  @Get("v1/admin/cms")
  adminCmsAlias(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.listPages();
  }

  @Get("v1/admin/cms/pages")
  adminPages(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.listPages();
  }

  @Get("v1/admin/cms/pages/:id")
  adminPage(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.getPage(id);
  }

  @Post("v1/admin/cms")
  upsertPageAlias(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.upsertPage(body, actor.id);
  }

  @Post("v1/admin/cms/pages")
  upsertPage(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.upsertPage(body, actor.id);
  }

  @Patch("v1/admin/cms/pages/:id")
  updatePage(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.updatePage(id, body, actor.id);
  }

  @Delete("v1/admin/cms/pages/:id")
  deletePage(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.deletePage(id, actor.id);
  }

  @Put("v1/admin/cms/pages/:id/metadata")
  saveMetadata(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { title?: string; description?: string; keywords?: string; ogImage?: string }
  ) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.saveMetadata(id, body);
  }

  @Get("v1/admin/banners")
  adminBannersAlias(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.adminBanners();
  }

  @Get("v1/admin/cms/banners")
  adminBanners(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.adminBanners();
  }

  @Post("v1/admin/banners")
  createBannerAlias(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.createBanner(body, actor.id);
  }

  @Post("v1/admin/cms/banners")
  createBanner(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.createBanner(body, actor.id);
  }

  @Patch("v1/admin/banners/:id")
  updateBannerAlias(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.updateBanner(id, body, actor.id);
  }

  @Patch("v1/admin/cms/banners/:id")
  updateBanner(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.updateBanner(id, body, actor.id);
  }

  @Delete("v1/admin/banners/:id")
  deleteBannerAlias(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.deleteBanner(id, actor.id);
  }

  @Delete("v1/admin/cms/banners/:id")
  deleteBanner(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.deleteBanner(id, actor.id);
  }

  @Get("v1/admin/cms/blogs")
  adminBlogs(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.adminBlogs();
  }

  @Post("v1/admin/cms/blogs")
  createBlog(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.createBlog(body, actor.id);
  }

  @Patch("v1/admin/cms/blogs/:id")
  updateBlog(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.updateBlog(id, body, actor.id);
  }

  @Delete("v1/admin/cms/blogs/:id")
  deleteBlog(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.deleteBlog(id, actor.id);
  }

  @Get("v1/admin/cms/categories")
  adminCategories(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.categories();
  }

  @Post("v1/admin/cms/categories")
  createCategory(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.createCategory(body, actor.id);
  }

  @Patch("v1/admin/cms/categories/:id")
  updateCategory(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.updateCategory(id, body, actor.id);
  }

  @Delete("v1/admin/cms/categories/:id")
  deleteCategory(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.deleteCategory(id, actor.id);
  }

  @Get("v1/admin/cms/comments")
  adminComments(@Req() req: Request, @Query("approved") approved?: string) {
    requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.cms.adminComments(approved);
  }

  @Patch("v1/admin/cms/comments/:id")
  moderateComment(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { approved?: boolean }
  ) {
    const actor = requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.cms.setCommentApproved(id, Boolean(body.approved), actor.id);
  }

  @Delete("v1/admin/cms/comments/:id")
  deleteComment(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.cms.deleteComment(id, actor.id);
  }

  @Get("v1/admin/cms/media")
  media(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.listMedia();
  }

  @Post("v1/admin/cms/media")
  createMediaJson(@Req() req: Request, @Body() body: { url?: string; filename?: string; mimeType?: string; sizeBytes?: number; category?: string }) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.createMedia(body, undefined, actor.id);
  }

  @Post("v1/admin/cms/media/upload")
  @UseInterceptors(fileInterceptor)
  createMediaFile(
    @Req() req: Request,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string; mimetype?: string; size?: number } | undefined,
    @Body() body: { category?: string }
  ) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.createMedia({ category: body.category }, file, actor.id);
  }

  @Delete("v1/admin/cms/media/:id")
  deleteMedia(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.deleteMedia(id, actor.id);
  }

  @Get("v1/admin/cms/testimonials")
  adminTestimonials(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.adminTestimonials();
  }

  @Post("v1/admin/cms/testimonials")
  createTestimonial(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.createTestimonial(body, actor.id);
  }

  @Patch("v1/admin/cms/testimonials/:id")
  updateTestimonial(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.updateTestimonial(id, body, actor.id);
  }

  @Delete("v1/admin/cms/testimonials/:id")
  deleteTestimonial(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.cms.deleteTestimonial(id, actor.id);
  }
}
