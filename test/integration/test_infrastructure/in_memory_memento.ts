/* This is an in-memory implementation of the VS Code globalState */
export class InMemoryMemento {
  state: Record<string, unknown>;

  constructor() {
    this.state = {};
  }

  async update(key: string, value: unknown) {
    this.state[key] = value;
  }

  get<T>(key: string): T | undefined;

  get<T>(key: string, defaultValue: T): T;

  get<T>(key: string, defaultValue?: T): T | undefined {
    return key in this.state ? (this.state[key] as T) : defaultValue;
  }

  keys(): string[] {
    return Object.keys(this.state);
  }
}
