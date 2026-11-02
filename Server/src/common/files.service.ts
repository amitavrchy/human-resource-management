import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, unlink, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';

@Injectable()
export class FilesService {
  private readonly directory: string;
  constructor(config: ConfigService) {
    this.directory = resolve(config.get<string>('UPLOAD_DIR') ?? './uploads');
  }
  async store(file: Express.Multer.File, resume = false) {
    if (!file || !file.size || file.size > 10 * 1024 * 1024)
      throw new BadRequestException('Upload a file between 1 byte and 10 MB.');
    let mimeType: string;
    if (file.buffer.subarray(0, 5).toString() === '%PDF-')
      mimeType = 'application/pdf';
    else if (
      !resume &&
      file.buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      mimeType = 'image/png';
    else if (
      !resume &&
      file.buffer[0] === 255 &&
      file.buffer[1] === 216 &&
      file.buffer[2] === 255
    )
      mimeType = 'image/jpeg';
    else if (
      ['text/plain', 'text/markdown'].includes(file.mimetype) &&
      !file.buffer.includes(0) &&
      !file.buffer.toString('utf8').includes('\uFFFD')
    )
      mimeType = 'text/plain';
    else
      throw new BadRequestException(
        resume
          ? 'Use a PDF or UTF-8 text resume.'
          : 'Use a PDF, UTF-8 text, PNG or JPEG file.',
      );
    const key = `${randomUUID()}.bin`;
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(join(this.directory, key), file.buffer, {
      mode: 0o600,
      flag: 'wx',
    });
    return {
      key,
      mimeType,
      size: file.size,
      text:
        mimeType === 'text/plain'
          ? file.buffer.toString('utf8').slice(0, 200000)
          : undefined,
    };
  }
  private path(key: string) {
    if (!/^[a-f0-9-]{36}\.bin$/.test(key))
      throw new NotFoundException('File not found.');
    return join(this.directory, key);
  }
  async stream(key: string) {
    const path = this.path(key);
    try {
      await access(path);
    } catch {
      throw new NotFoundException('File is unavailable.');
    }
    return createReadStream(path);
  }
  async bytes(key: string) {
    return readFile(this.path(key));
  }
  async remove(key: string) {
    try {
      await unlink(this.path(key));
    } catch {
      /* Missing files are already removed. */
    }
  }
}
