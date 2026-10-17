import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../config/app-config.service';

interface StreamTokenPayload {
  sub: string;
  fileId: string;
  type: 'stream';
}

export interface SignedStreamUrl {
  url: string;
  expiresInSeconds: number;
}

/**
 * Mints and checks the short-lived tokens that let `<iframe>`, `<video>` and
 * `<img>` elements read a stored file; they cannot send the Bearer header the
 * rest of the API requires, so the grant travels in the query string instead.
 *
 * It lives in the storage module rather than in one feature module because
 * both course files and assessments hand out these links. The token scheme and
 * the `/api/files/stream/:id` route that redeems it have to agree exactly, so
 * there is one implementation and no second copy to forget.
 */
@Injectable()
export class StreamTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  sign(userId: string, fileId: string): SignedStreamUrl {
    const expiresInSeconds = this.config.storage.streamUrlTtlSeconds;
    const payload: StreamTokenPayload = { sub: userId, fileId, type: 'stream' };
    const token = this.jwtService.sign(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: expiresInSeconds,
    });

    return {
      url: `/api/files/stream/${fileId}?token=${encodeURIComponent(token)}`,
      expiresInSeconds,
    };
  }

  /** Throws unless `token` is a live stream grant for exactly `fileId`. */
  verify(token: string, fileId: string): StreamTokenPayload {
    let payload: StreamTokenPayload;
    try {
      payload = this.jwtService.verify<StreamTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('This link has expired. Reopen the file to get a new one.');
    }

    if (payload.type !== 'stream' || payload.fileId !== fileId) {
      throw new UnauthorizedException('Stream token does not match this file');
    }

    return payload;
  }
}
