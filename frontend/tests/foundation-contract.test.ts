import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classNames } from '../src/lib/class-names';

const frontendRoot = resolve(import.meta.dirname, '..');

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collectSourceFiles(path) : [path];
  });
}

function relativeLuminance([red, green, blue]: number[]): number {
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: number[], background: number[]): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function parseColorVariables(block: string): Map<string, number[]> {
  const variables = new Map<string, number[]>();
  for (const match of block.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)) {
    variables.set(match[1], [
      Number.parseInt(match[2], 10),
      Number.parseInt(match[3], 10),
      Number.parseInt(match[4], 10),
    ]);
  }
  return variables;
}

describe('design token contract', () => {
  it('keeps class composition deterministic and excludes false values', () => {
    expect(classNames('base', false, undefined, 'active', null)).toBe('base active');
  });

  it('defines light and dark semantic variables with fixed-alpha pairs', () => {
    const tokens = readFileSync(resolve(frontendRoot, 'src/styles/tokens.css'), 'utf8');

    expect(tokens).toContain(':root {');
    expect(tokens).toContain("[data-theme='dark']");
    expect(tokens).toContain('--color-action-primary-bg:');
    expect(tokens).toContain('--color-focus-ring:');
    expect(tokens).toContain('--color-scrim-rgb:');
    expect(tokens).toContain('--opacity-scrim:');
    expect(tokens).not.toMatch(/--color-[^:]+:\\s*#/);
  });

  it('uses the approved Tailwind selector and semantic aliases', () => {
    const config = readFileSync(resolve(frontendRoot, 'tailwind.config.js'), 'utf8');

    expect(config).toContain("darkMode: ['selector', '[data-theme=\"dark\"]']");
    expect(config).toContain("'action-primary-bg'");
    expect(config).toContain("scrim: fixedAlpha('--color-scrim-rgb', '--opacity-scrim')");
    expect(config).not.toContain('brand: {');
    expect(config).not.toContain('redButton');
  });

  it('keeps reduced-motion and forced-colors safeguards in global CSS', () => {
    const globals = readFileSync(resolve(frontendRoot, 'src/styles/globals.css'), 'utf8');

    expect(globals).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globals).toContain('@media (forced-colors: active)');
    expect(globals).toContain('.skeleton::after');
    expect(globals).toContain('.spinner');
  });

  it('keeps product source free from raw colors and palette utilities', () => {
    const sourceFiles = collectSourceFiles(resolve(frontendRoot, 'src')).filter(
      (file) => !file.endsWith('tokens.css'),
    );
    const source = sourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

    expect(source).not.toMatch(/#[\da-f]{3,8}\b/i);
    expect(source).not.toMatch(
      /\b(?:bg|text|border|ring|shadow)-(?:red|slate|gray|zinc|stone|emerald|amber|blue|purple)-\d+\b/,
    );
  });

  it('centralizes shared button and form-control behavior', () => {
    const button = readFileSync(
      resolve(frontendRoot, 'src/components/primitives/Button.tsx'),
      'utf8',
    );
    const buttonBase = readFileSync(
      resolve(frontendRoot, 'src/components/primitives/button-base.tsx'),
      'utf8',
    );
    const iconButton = readFileSync(
      resolve(frontendRoot, 'src/components/primitives/IconButton.tsx'),
      'utf8',
    );
    const toast = readFileSync(resolve(frontendRoot, 'src/components/feedback/Toast.tsx'), 'utf8');
    const controls = ['Input.tsx', 'Textarea.tsx', 'Select.tsx'].map((file) =>
      readFileSync(resolve(frontendRoot, 'src/components/primitives', file), 'utf8'),
    );

    expect(buttonBase).toContain('const intentClasses');
    expect(button).toContain('<ButtonBase');
    expect(iconButton).toContain('<ButtonBase');
    expect(button).not.toContain('const intentClasses');
    expect(iconButton).not.toContain('const intentClasses');
    expect(toast).toContain('<Button');
    expect(toast).not.toContain('<button');

    for (const control of controls) {
      expect(control).toContain('useFormControlAccessibilityProps');
      expect(control).not.toContain('useFormField');
    }
  });

  it.each([
    ['light', ':root'],
    ['dark', "[data-theme='dark']"],
  ])('meets critical %s theme contrast thresholds', (_theme, selector) => {
    const tokens = readFileSync(resolve(frontendRoot, 'src/styles/tokens.css'), 'utf8');
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = tokens.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1];
    expect(block).toBeDefined();
    const colors = parseColorVariables(block ?? '');

    const pairs: Array<[string, string, number]> = [
      ['color-text-primary', 'color-bg-surface', 4.5],
      ['color-text-secondary', 'color-bg-surface', 4.5],
      ['color-placeholder', 'color-bg-surface', 4.5],
      ['color-link-default', 'color-bg-surface', 4.5],
      ['color-action-primary-text', 'color-action-primary-bg', 4.5],
      ['color-action-danger-text', 'color-action-danger-bg', 4.5],
      ['color-focus-ring', 'color-bg-surface', 3],
      ['color-border-control', 'color-bg-surface', 3],
      ['color-success-text', 'color-success-bg', 4.5],
      ['color-warning-text', 'color-warning-bg', 4.5],
      ['color-danger-text', 'color-danger-bg', 4.5],
      ['color-info-text', 'color-info-bg', 4.5],
    ];

    for (const [foreground, background, minimum] of pairs) {
      expect(
        contrastRatio(colors.get(foreground) ?? [], colors.get(background) ?? []),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(minimum);
    }
  });
});
