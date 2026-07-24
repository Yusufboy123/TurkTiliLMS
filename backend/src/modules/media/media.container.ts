import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { environment } from '../../config/environment.js';
import { MediaController } from './media.controller.js';
import { SecureMediaFileInspector } from './media.inspector.js';
import { PrismaMediaRepository } from './media.repository.js';
import { MediaService } from './media.service.js';
import { LocalMediaStorage } from './media.storage.js';
import { createMediaUploadMiddleware } from './media.upload.middleware.js';

const projectRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const mediaStorageRoot = isAbsolute(environment.MEDIA_STORAGE_ROOT)
  ? environment.MEDIA_STORAGE_ROOT
  : resolve(projectRoot, environment.MEDIA_STORAGE_ROOT);

export const localMediaStorage = new LocalMediaStorage(mediaStorageRoot);
export const mediaService = new MediaService(
  new PrismaMediaRepository(),
  localMediaStorage,
  new SecureMediaFileInspector(environment.MEDIA_MAX_UPLOAD_BYTES),
);
export const mediaController = new MediaController(mediaService);
export const mediaUploadMiddleware = createMediaUploadMiddleware({
  stagingDirectory: localMediaStorage.stagingDirectory,
  maximumSizeBytes: environment.MEDIA_MAX_UPLOAD_BYTES,
});
