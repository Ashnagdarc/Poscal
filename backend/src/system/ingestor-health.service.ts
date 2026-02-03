import { Injectable } from '@nestjs/common';
import * as fs from 'fs';

interface IngestorHealth {
  recent_401_count: number;
  last_401_at: string | null;
  last_flush_at: string | null;
  backend_reachable: boolean;
}

@Injectable()
export class IngestorHealthService {
  private readonly errorLogPath =
    process.env.INGESTOR_ERROR_LOG || '/root/.pm2/logs/poscal-price-ingestor-error-2.log';
  private readonly outLogPath =
    process.env.INGESTOR_OUT_LOG || '/root/.pm2/logs/poscal-price-ingestor-out-2.log';

  getHealth(): IngestorHealth {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;

    const errorLines = this.safeReadLines(this.errorLogPath);
    const outLines = this.safeReadLines(this.outLogPath);

    let recent401 = 0;
    let last401: string | null = null;
    for (const line of errorLines) {
      if (!line.includes('status":401')) continue;
      const ts = this.extractTimestamp(line);
      if (!ts) continue;
      if (now - ts <= windowMs) {
        recent401 += 1;
      }
      if (!last401 || ts > Date.parse(last401)) {
        last401 = new Date(ts).toISOString();
      }
    }

    let lastFlush: string | null = null;
    for (const line of outLines) {
      if (!line.includes('Flushed price batch')) continue;
      const ts = this.extractTimestamp(line);
      if (!ts) continue;
      if (!lastFlush || ts > Date.parse(lastFlush)) {
        lastFlush = new Date(ts).toISOString();
      }
    }

    return {
      recent_401_count: recent401,
      last_401_at: last401,
      last_flush_at: lastFlush,
      backend_reachable: true,
    };
  }

  private safeReadLines(path: string): string[] {
    try {
      if (!fs.existsSync(path)) return [];
      return fs.readFileSync(path, 'utf8').split('\n');
    } catch {
      return [];
    }
  }

  private extractTimestamp(line: string): number | null {
    const match = line.match(/^\[(.+?)\]/);
    if (!match) return null;
    const ts = Date.parse(match[1].replace('Z', '+00:00'));
    return Number.isNaN(ts) ? null : ts;
  }
}
