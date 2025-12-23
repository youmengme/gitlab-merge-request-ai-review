export class Position {
  readonly line: number;

  readonly character: number;

  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }

  isEqual(position: Position) {
    return this.line === position.line && this.character === position.character;
  }

  isBefore(position: Position) {
    return (
      this.line < position?.line ||
      (position.line === this.line && this.character < position.character)
    );
  }

  compareTo(position: Position): number {
    if (this.line === position.line) {
      return this.character - position.character;
    }
    return this.line - position.line;
  }
}
