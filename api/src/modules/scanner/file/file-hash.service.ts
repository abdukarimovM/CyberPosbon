import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

export interface FileHashes {
  md5: string;
  sha1: string;
  sha256: string;
}

@Injectable()
export class FileHashService {
  /**
   * Faylning SHA-256 hashini xavfsiz hisoblaydi.
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
        stream.destroy();
        reject(error);
      });
    });
  }

  /**
   * Fayldan bir vaqtning o'zida barcha asosiy xavfsizlik xeshlarini (MD5, SHA-1, SHA-256) oladi.
   * Faylni diskdan faqat 1 marta o'qiydi (resurs tejaydi).
   */
  async calculateAllHashes(filePath: string): Promise<FileHashes> {
    return new Promise((resolve, reject) => {
      const md5 = createHash('md5');
      const sha1 = createHash('sha1');
      const sha256 = createHash('sha256');

      const stream = createReadStream(filePath);

      stream.on('data', (chunk) => {
        md5.update(chunk);
        sha1.update(chunk);
        sha256.update(chunk);
      });

      stream.on('end', () => {
        resolve({
          md5: md5.digest('hex'),
          sha1: sha1.digest('hex'),
          sha256: sha256.digest('hex'),
        });
      });

      stream.on('error', (error) => {
        stream.destroy();
        reject(error);
      });
    });
  }
}