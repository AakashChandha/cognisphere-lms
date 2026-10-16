import { ApiProperty } from '@nestjs/swagger';

export class FileStreamUrlDto {
  @ApiProperty({
    description:
      'Same-origin URL the browser can open directly (e.g. as <video src>). Carries a signed, single-file token.',
    example: '/api/files/stream/3f1c…?token=eyJ…',
  })
  url: string;

  @ApiProperty({ description: 'Seconds until the URL stops working' })
  expiresInSeconds: number;
}
