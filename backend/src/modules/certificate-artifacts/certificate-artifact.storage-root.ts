import { isAbsolute, parse, relative, resolve, sep } from 'node:path';

function isSameOrNested(parentPath: string, candidatePath: string): boolean {
  const pathFromParent = relative(parentPath, candidatePath);
  return (
    pathFromParent === '' ||
    (pathFromParent !== '..' &&
      !pathFromParent.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromParent))
  );
}

export function resolveCertificateArtifactStorageRoot(
  projectRoot: string,
  configuredCertificateRoot: string,
  configuredMediaRoot: string,
): string {
  const resolvedProjectRoot = resolve(projectRoot);
  const certificateRoot = isAbsolute(configuredCertificateRoot)
    ? resolve(configuredCertificateRoot)
    : resolve(resolvedProjectRoot, configuredCertificateRoot);
  const mediaRoot = isAbsolute(configuredMediaRoot)
    ? resolve(configuredMediaRoot)
    : resolve(resolvedProjectRoot, configuredMediaRoot);

  const isFilesystemRoot = certificateRoot === parse(certificateRoot).root;
  const overlapsProjectRoot = certificateRoot === resolvedProjectRoot;
  const relativeRootEscapesProject =
    !isAbsolute(configuredCertificateRoot) && !isSameOrNested(resolvedProjectRoot, certificateRoot);
  const overlapsMediaStorage =
    isSameOrNested(mediaRoot, certificateRoot) || isSameOrNested(certificateRoot, mediaRoot);

  if (
    isFilesystemRoot ||
    overlapsProjectRoot ||
    relativeRootEscapesProject ||
    overlapsMediaStorage
  ) {
    throw new Error('Certificate artifact storage root must be a dedicated private directory.');
  }

  return certificateRoot;
}
