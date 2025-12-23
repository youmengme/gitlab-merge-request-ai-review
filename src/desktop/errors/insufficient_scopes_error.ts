export class InsufficientScopesError extends Error {
  #expectedScopes: string[];

  #actualScopes: string[];

  constructor(actualScopes: string[], expectedScopes: string[]) {
    super();

    this.#actualScopes = actualScopes;
    this.#expectedScopes = expectedScopes;
  }

  #formatScopesString() {
    const missingScopes = this.#expectedScopes
      .filter(scope => !this.#actualScopes.includes(scope))
      .map(scope => `'${scope}'`);

    if (missingScopes.length === 1) {
      return `${missingScopes[0]} scope`;
    }

    const scopesWithoutLastOne = missingScopes.slice(0, -1);
    const [lastScope] = missingScopes.slice(-1);

    return `${scopesWithoutLastOne.join(', ')} and ${lastScope} scopes`;
  }

  get message() {
    return `Insufficient scopes: token is missing ${this.#formatScopesString()}`;
  }
}
