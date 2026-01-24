import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private uploadsRoot = path.join(process.cwd(), 'uploads');

  private async ensureDir(dirPath: string) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  private async saveBufferToFile(buffer: Buffer, filePath: string) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, buffer);
  }

  async saveAvatar(userId: string, file: any): Promise<string> {
    const fileName = file?.originalname || `avatar-${Date.now()}.png`;
    const targetPath = path.join(this.uploadsRoot, 'avatars', userId, fileName);
    const buffer: Buffer = file?.buffer || (file?.path ? await fs.readFile(file.path) : Buffer.from([]));
    await this.saveBufferToFile(buffer, targetPath);
    return `/uploads/avatars/${userId}/${fileName}`;
  }

  async deleteAvatar(userId: string, fileName: string): Promise<void> {
    const targetPath = path.join(this.uploadsRoot, 'avatars', userId, fileName);
    try { await fs.unlink(targetPath); } catch {}
  }

  async saveTradeScreenshot(tradeId: string, file: any): Promise<string> {
    const fileName = file?.originalname || `screenshot-${Date.now()}.png`;
    const targetPath = path.join(this.uploadsRoot, 'trades', tradeId, fileName);
    const buffer: Buffer = file?.buffer || (file?.path ? await fs.readFile(file.path) : Buffer.from([]));
    await this.saveBufferToFile(buffer, targetPath);
    return `/uploads/trades/${tradeId}/${fileName}`;
  }

  async deleteTradeScreenshot(tradeId: string, fileName: string): Promise<void> {
    const targetPath = path.join(this.uploadsRoot, 'trades', tradeId, fileName);
    try { await fs.unlink(targetPath); } catch {}
  }
}