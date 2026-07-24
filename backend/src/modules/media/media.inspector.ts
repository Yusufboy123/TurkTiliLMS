import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { fileTypeFromFile } from 'file-type';
import { AppError } from '../../utils/app-error.js';
import type { InspectedMediaUpload, MediaTypePolicy, StagedMediaUpload } from './media.types.js';

const compoundFileSignature = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

export interface MediaFileInspector {
  inspect(
    stagedUpload: StagedMediaUpload,
    originalFileName: string,
    policy: MediaTypePolicy,
  ): Promise<InspectedMediaUpload>;
}

async function hasCompoundFileSignature(path: string): Promise<boolean> {
  const handle = await open(path, 'r');
  try {
    const header = Buffer.alloc(compoundFileSignature.length);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return bytesRead === header.length && header.equals(compoundFileSignature);
  } finally {
    await handle.close();
  }
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

export class SecureMediaFileInspector implements MediaFileInspector {
  constructor(private readonly maximumSizeBytes: number) {}

  async inspect(
    stagedUpload: StagedMediaUpload,
    originalFileName: string,
    policy: MediaTypePolicy,
  ): Promise<InspectedMediaUpload> {
    const fileStats = await stat(stagedUpload.path);

    if (fileStats.size === 0) {
      throw new AppError('Bo‘sh fayl yuklab bo‘lmaydi.', 422, 'MEDIA_FILE_EMPTY');
    }

    if (fileStats.size > this.maximumSizeBytes) {
      throw new AppError(
        `Fayl hajmi ${this.maximumSizeBytes} baytdan oshmasligi kerak.`,
        413,
        'MEDIA_FILE_TOO_LARGE',
      );
    }

    if (fileStats.size !== stagedUpload.sizeBytes) {
      throw new AppError('Fayl hajmi yuklash vaqtida o‘zgardi.', 422, 'MEDIA_FILE_SIZE_MISMATCH');
    }

    const detected = await fileTypeFromFile(stagedUpload.path);
    const acceptedDetectedExtensions = policy.acceptedDetectedExtensions as readonly string[];
    const isLegacyOfficeContainer =
      (policy.extension === 'doc' || policy.extension === 'ppt') &&
      (!detected || detected.ext === 'cfb') &&
      (await hasCompoundFileSignature(stagedUpload.path));

    if (
      (!detected || !acceptedDetectedExtensions.includes(detected.ext)) &&
      !isLegacyOfficeContainer
    ) {
      throw new AppError(
        'Faylning haqiqiy turi uning nomi va MIME turiga mos emas.',
        422,
        'MEDIA_SIGNATURE_MISMATCH',
      );
    }

    return {
      originalFileName,
      category: policy.category,
      extension: policy.extension,
      mimeType: policy.canonicalMimeType,
      sizeBytes: fileStats.size,
      checksum: await sha256(stagedUpload.path),
    };
  }
}
