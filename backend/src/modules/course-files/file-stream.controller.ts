import { Controller, Get, Param, Query, Res, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { LocalStorageService } from '../storage/local-storage.service';
import { CourseFilesService } from './course-files.service';

/**
 * Serves course material to `<video>`, `<iframe>` and `<a>` elements, which
 * cannot attach the Bearer header the rest of the API requires. Access is
 * granted by a short-lived token issued by the role-scoped `stream-url`
 * endpoints after the usual enrollment/ownership check.
 *
 * Express `sendFile` honours HTTP Range requests, so video seeking works and
 * only the requested bytes are read from disk.
 */
@ApiTags('Files')
@Public()
@SkipThrottle()
@Controller('files')
export class FileStreamController {
  constructor(
    private readonly filesService: CourseFilesService,
    private readonly localStorage: LocalStorageService,
  ) {}

  @Get('stream/:id')
  @ApiOperation({ summary: 'Stream a course file using a signed token (supports Range requests)' })
  @ApiQuery({ name: 'token', required: true })
  async stream(@Param('id') id: string, @Query('token') token: string | undefined, @Res() res: Response) {
    if (!token) {
      throw new UnauthorizedException('A stream token is required');
    }

    const file = await this.filesService.getForStreamToken(token, id);

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=0');
    return res.sendFile(this.localStorage.resolveAbsolutePath(file.storageKey), { acceptRanges: true });
  }

  /**
   * Course cover images, unsigned and cacheable. A cover image is not
   * protected IP, and signing it would mean a round trip per card in a list;
   * only `COURSE_THUMBNAIL` files are reachable here, so course material
   * still needs a signed token.
   */
  @Get('thumbnail/:fileId')
  @ApiOperation({ summary: 'Serve a course cover image (public, cacheable)' })
  async thumbnail(@Param('fileId') fileId: string, @Res() res: Response) {
    const file = await this.filesService.getThumbnailForPublicStream(fileId);

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(this.localStorage.resolveAbsolutePath(file.storageKey));
  }
}
