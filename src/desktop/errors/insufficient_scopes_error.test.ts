import { InsufficientScopesError } from './insufficient_scopes_error';

describe('InsufficientScopesError', () => {
  const EXPECTED_SCOPES = ['a', 'b', 'c'];

  it('generates correct message for single missing scope', () => {
    const error = new InsufficientScopesError(['a', 'b'], EXPECTED_SCOPES);
    expect(error.message).toBe(`Insufficient scopes: token is missing 'c' scope`);
  });

  it('generates correct message for multiple missing scopes', () => {
    const error = new InsufficientScopesError([], EXPECTED_SCOPES);
    expect(error.message).toBe(`Insufficient scopes: token is missing 'a', 'b' and 'c' scopes`);
  });
});
