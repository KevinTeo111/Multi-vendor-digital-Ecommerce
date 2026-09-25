process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef0123456789';

import { parseOrigins } from './env';

describe('parseOrigins', () => {
  it('splits a comma-separated list and trims blanks and trailing slashes', () => {
    expect(parseOrigins('https://a.com/, https://b.com ,,')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('keeps a single origin as a one-element list', () => {
    expect(parseOrigins('http://localhost:3000')).toEqual(['http://localhost:3000']);
  });
});
