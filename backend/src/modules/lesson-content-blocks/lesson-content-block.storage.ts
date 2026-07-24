import type { PublicLessonContentBlock } from './lesson-content-block.types.js';

/**
 * Delivery adapters may replace stored object references with short-lived
 * signed URLs when S3, MinIO, or another protected storage provider is added.
 */
export interface LessonContentBlockDelivery {
  prepare(block: PublicLessonContentBlock): Promise<PublicLessonContentBlock>;
}

/**
 * The current release stores validated HTTP(S) URLs and metadata only. It does
 * not receive binary uploads or fetch remote content in the API process.
 */
export class MetadataOnlyLessonContentBlockDelivery implements LessonContentBlockDelivery {
  prepare(block: PublicLessonContentBlock): Promise<PublicLessonContentBlock> {
    return Promise.resolve(block);
  }
}
