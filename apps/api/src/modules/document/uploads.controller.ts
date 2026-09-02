import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { currentUser } from "../../lib/auth";
import { sanitizeFolder, uploadToCloudinary } from "../../lib/cloudinary";

const fileInterceptor = FileInterceptor("file", {
  limits: { fileSize: 8 * 1024 * 1024 },
});

type UploadBody = { folder?: string; url?: string; kind?: string };

@Controller()
export class UploadsController {
  @Post("v1/uploads")
  @UseInterceptors(fileInterceptor)
  async upload(
    @Req() req: Request,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string; mimetype?: string } | undefined,
    @Body() body: UploadBody
  ) {
    currentUser(req);
    const folder = sanitizeFolder(body?.folder);
    return uploadToCloudinary({
      folder,
      url: body?.url,
      buffer: file?.buffer,
      filename: file?.originalname,
      mimetype: file?.mimetype,
    });
  }

  @Post("v1/public/uploads")
  @UseInterceptors(fileInterceptor)
  async publicUpload(
    @UploadedFile() file: { buffer?: Buffer; originalname?: string; mimetype?: string } | undefined,
    @Body() body: UploadBody
  ) {
    const folder = sanitizeFolder(body?.folder, true);
    return uploadToCloudinary({
      folder,
      url: body?.url,
      buffer: file?.buffer,
      filename: file?.originalname,
      mimetype: file?.mimetype,
    });
  }
}
