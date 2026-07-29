import { mkdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export function resolveContainedPath(
  rootDirectory: string,
  storagePath: string,
  createError: () => Error,
): string {
  if (isAbsolute(storagePath)) {
    throw createError();
  }

  const resolvedRoot = resolve(rootDirectory);
  const absolutePath = resolve(resolvedRoot, storagePath);
  const pathFromRoot = relative(resolvedRoot, absolutePath);

  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw createError();
  }

  return absolutePath;
}

export function assertContainedPath(
  rootDirectory: string,
  candidatePath: string,
  createError: () => Error,
): void {
  const resolvedRoot = resolve(rootDirectory);
  const pathFromRoot = relative(resolvedRoot, resolve(candidatePath));

  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw createError();
  }
}

export async function resolveContainedRealParent(
  rootDirectory: string,
  candidatePath: string,
  createError: () => Error,
): Promise<string> {
  let realRoot: string;
  let realParent: string;
  try {
    [realRoot, realParent] = await Promise.all([
      realpath(resolve(rootDirectory)),
      realpath(dirname(resolve(candidatePath))),
    ]);
  } catch {
    throw createError();
  }
  assertContainedPath(realRoot, realParent, createError);
  return join(realParent, basename(candidatePath));
}

export async function ensureContainedDirectory(
  rootDirectory: string,
  directoryPath: string,
  createError: () => Error,
): Promise<string> {
  const resolvedRoot = resolve(rootDirectory);
  const resolvedDirectory = resolve(directoryPath);
  assertContainedPath(resolvedRoot, resolvedDirectory, createError);
  const directoryFromRoot = relative(resolvedRoot, resolvedDirectory);
  const segments = directoryFromRoot === '' ? [] : directoryFromRoot.split(sep);
  let currentDirectory: string;

  try {
    currentDirectory = await realpath(resolvedRoot);
  } catch {
    throw createError();
  }

  for (const segment of segments) {
    const nextDirectory = join(currentDirectory, segment);
    try {
      await mkdir(nextDirectory, { mode: 0o700 });
    } catch (error: unknown) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
        throw createError();
      }
    }

    try {
      currentDirectory = await realpath(nextDirectory);
      if (!(await stat(currentDirectory)).isDirectory()) throw createError();
    } catch {
      throw createError();
    }
    assertContainedPath(await realpath(resolvedRoot), currentDirectory, createError);
  }

  return currentDirectory;
}
