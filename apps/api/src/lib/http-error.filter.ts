import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import type { Response } from "express";

/** Apps that show `error` would otherwise display Nest's generic "Bad Request". */
export function readableError(body: unknown, fallback: string) {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const { message, error } = body as { message?: unknown; error?: unknown };
    if (Array.isArray(message) && message.length) return message.map(String).join("; ");
    if (typeof message === "string" && message.trim()) return message;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

@Catch(HttpException)
export class ReadableHttpErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();
    const message = readableError(body, exception.message);
    const extra = body && typeof body === "object" ? body : {};
    res.status(status).json({ ...extra, statusCode: status, message, error: message });
  }
}
