import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok';
  service: string;
  database: {
    status: 'connected';
    checkedAt: Date;
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const result = await this.prisma.$queryRaw<{ checked_at: Date }[]>`SELECT NOW() AS checked_at`;

      return {
        status: 'ok',
        service: 'lms-backend',
        database: {
          status: 'connected',
          checkedAt: result[0].checked_at,
        },
      };
    } catch {
      throw new ServiceUnavailableException('Database connection is unavailable');
    }
  }
}
