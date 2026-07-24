import type { PublicLessonContentBlock } from './lesson-content-block.types.js';

/**
 * Delivery adapters may replace stored object references with short-lived
 * signed URLs when S3, MinIO, or another protected storage provider is added.
 */
export interface LessonContentBlockDelivery {
  prepare(block: PublicLessonContentBlock): Promise<PublicLessonContentBlock>;
}

/**
 * Lesson content blocks currently retain validated delivery references. Media
 * upload and protected binary delivery are owned by the media module.
 */
export class MetadataOnlyLessonContentBlockDelivery implements LessonContentBlockDelivery {
  prepare(block: PublicLessonContentBlock): Promise<PublicLessonContentBlock> {
    return Promise.resolve(block);
  }
}
