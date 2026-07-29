import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  NOTO_SANS_ASSET_ID,
  NOTO_SANS_FAMILY,
  NOTO_SANS_LICENSE_IDENTIFIER,
  NOTO_SANS_PACKAGE_VERSION,
} from './certificate-artifact.constants.js';
import { fontAssetUnavailable } from './certificate-artifact.errors.js';
import type {
  CertificateFontBuffers,
  CertificateFontSource,
} from './certificate-artifact.types.js';

const require = createRequire(import.meta.url);
const notoSansPackage = require('@expo-google-fonts/noto-sans/package.json') as {
  version?: unknown;
};
const regularFontPath =
  require.resolve('@expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf');
const boldFontPath = require.resolve('@expo-google-fonts/noto-sans/700Bold/NotoSans_700Bold.ttf');

function fontBundleChecksum(regular: Buffer, bold: Buffer): string {
  const hash = createHash('sha256');
  const regularLength = Buffer.allocUnsafe(8);
  const boldLength = Buffer.allocUnsafe(8);
  regularLength.writeBigUInt64BE(BigInt(regular.length));
  boldLength.writeBigUInt64BE(BigInt(bold.length));
  hash.update(regularLength).update(regular).update(boldLength).update(bold);
  return hash.digest('hex');
}

export class PackageNotoSansFontSource implements CertificateFontSource {
  private loaded: Promise<CertificateFontBuffers> | undefined;

  load(): Promise<CertificateFontBuffers> {
    this.loaded ??= this.loadFromPackage();
    return this.loaded;
  }

  private async loadFromPackage(): Promise<CertificateFontBuffers> {
    try {
      if (notoSansPackage.version !== NOTO_SANS_PACKAGE_VERSION) {
        throw fontAssetUnavailable();
      }
      const [regular, bold] = await Promise.all([
        readFile(regularFontPath),
        readFile(boldFontPath),
      ]);
      if (regular.length === 0 || bold.length === 0) throw fontAssetUnavailable();

      return Object.freeze({
        regular,
        bold,
        manifest: Object.freeze({
          assetId: NOTO_SANS_ASSET_ID,
          family: NOTO_SANS_FAMILY,
          version: NOTO_SANS_PACKAGE_VERSION,
          licenseIdentifier: NOTO_SANS_LICENSE_IDENTIFIER,
          licenseProvenance:
            'npm:@expo-google-fonts/noto-sans@0.4.2; Noto Sans; SIL Open Font License 1.1',
          checksum: fontBundleChecksum(regular, bold),
        }),
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'CertificateArtifactError') throw error;
      throw fontAssetUnavailable();
    }
  }
}
