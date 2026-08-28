import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

@Injectable()
export class FileHashService {
  /**
   * Faylning SHA-256 hashini hisoblaydi.
   */
  async calculateSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }
}