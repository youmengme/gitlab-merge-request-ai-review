import { createFakePartial } from '../test_utils/create_fake_partial';
import { FetchError, isMissingDefaultDuoGroupError } from './fetch_error';

describe('FetchError', () => {
  it('indicates invalid token', () => {
    const error = new FetchError(
      createFakePartial<Response>({
        ok: false,
        url: 'https://example.com/api/v4/project',
        status: 401,
      }),
      'resource name',
      `{ "error": "invalid_token" }`,
    );
    expect(error.isInvalidToken()).toBe(true);
    expect(error.message).toMatch(/token is expired or revoked/);
  });

  it('indicates invalid grant as invalid token', () => {
    const error = new FetchError(
      createFakePartial<Response>({
        ok: false,
        url: 'https://example.com/api/v4/project',
        status: 400,
      }),
      'resource name',
      `{ "error": "invalid_grant" }`,
    );
    expect(error.isInvalidToken()).toBe(true);
    expect(error.message).toMatch(/Request to refresh token failed/);
  });
});

describe('isMissingDefaultDuoGroupError', () => {
  const createMockFetchError = (body?: string) =>
    new FetchError(
      createFakePartial<Response>({
        ok: false,
        url: 'https://example.com/api/v4/project',
        status: 400,
      }),
      'resource name',
      body,
    );

  it('should return `true` if error contains `missing_default_duo_group` error body', () => {
    const error = createMockFetchError(`{ "error": "missing_default_duo_group" }`);
    expect(isMissingDefaultDuoGroupError(error)).toBe(true);
  });

  it.each([
    createMockFetchError(`{ "error": "invalid_grant" }`),
    createMockFetchError(''),
    new Error('Some other error'),
  ])('it returns `false` if error does not pertain to `missing_default_duo_group` error', error => {
    expect(isMissingDefaultDuoGroupError(error)).toBe(false);
  });
});
