import { tryParseUrl } from './try_parse_url';

describe('tryParseUrl', () => {
  it('parses a valid URL', () => {
    const url = 'https://example.com/path';
    const result = tryParseUrl(url);

    expect(result).toBeInstanceOf(URL);
    expect(result?.href).toBe(url);
  });

  it('returns undefined for an invalid URL', () => {
    const invalidUrl = 'this is not a url';

    expect(tryParseUrl(invalidUrl)).toBeUndefined();
  });
});
