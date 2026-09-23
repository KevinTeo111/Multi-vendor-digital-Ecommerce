import { randomBytes } from 'node:crypto';

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Appends a short random suffix so retries after a unique-constraint hit converge quickly. */
export function slugWithSuffix(input: string): string {
  return `${slugify(input)}-${randomBytes(3).toString('hex')}`;
}
