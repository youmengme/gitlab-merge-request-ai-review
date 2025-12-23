import * as vscode from 'vscode';

export enum SuggestionChangeType {
  Unknown = 'Unknown',
  InvalidDocument = 'InvalidDocument',
  NoChange = 'NoChange',
  DeletedCharacter = 'DeletedCharacter',
  RepeatedSpaces = 'RepeatedSpaces',
}

export interface CodeSuggestionsChangeTracker extends vscode.Disposable {
  trackCompletionRequest(document: vscode.TextDocument, position: vscode.Position): void;
  getLastChangeType: (document: vscode.TextDocument) => SuggestionChangeType;
  readonly eventsHistorySize: number;
}

const HISTORY_SIZE = 50;

export class DefaultCodeSuggestionsChangeTracker implements CodeSuggestionsChangeTracker {
  #changeHistory: Array<{
    document: vscode.TextDocument;
    position: vscode.Position;
  }>;

  constructor() {
    this.#changeHistory = [];
  }

  get eventsHistorySize(): number {
    return this.#changeHistory.length;
  }

  trackCompletionRequest(document: vscode.TextDocument, position: vscode.Position): void {
    this.#garbageCollectHistory();
    this.#changeHistory.push({ document, position });
  }

  getLastChangeType(document: vscode.TextDocument): SuggestionChangeType {
    if (this.#isNoChange()) {
      return SuggestionChangeType.NoChange;
    }

    if (this.#isInvalidDocument(document)) {
      return SuggestionChangeType.InvalidDocument;
    }

    if (this.#isDeletedCharacter()) {
      return SuggestionChangeType.DeletedCharacter;
    }

    if (this.#isRepeatedSpaces()) {
      return SuggestionChangeType.RepeatedSpaces;
    }

    return SuggestionChangeType.Unknown;
  }

  dispose() {
    this.#changeHistory.length = 0;
  }

  #isNoChange(): boolean {
    if (this.#changeHistory.length === 0) {
      return true;
    }

    if (this.#changeHistory.length === 1) {
      return false;
    }

    const [secondLast, last] = this.#changeHistory.slice(-2);

    return last.position.isEqual(secondLast.position);
  }

  #isInvalidDocument(document: vscode.TextDocument): boolean {
    const last = this.#changeHistory.slice(-1)[0];

    return last.document.uri.toString() !== document.uri.toString();
  }

  #isDeletedCharacter(): boolean {
    if (this.#changeHistory.length < 2) {
      return false;
    }

    const [secondLast, last] = this.#changeHistory.slice(-2);

    return (
      last.position.line === secondLast.position.line && last.position.isBefore(secondLast.position)
    );
  }

  #isRepeatedSpaces(): boolean {
    if (this.#changeHistory.length < 4) {
      return false;
    }

    const lastFourChanges = this.#changeHistory.slice(-4);
    const [first, , , last] = lastFourChanges;
    const text = last.document.getText(new vscode.Range(first.position, last.position));

    return (
      lastFourChanges.every(({ position }) => position.line === last.position.line) &&
      text.length === 3 &&
      text.trim().length === 0
    );
  }

  #garbageCollectHistory() {
    if (this.#changeHistory.length >= HISTORY_SIZE) {
      this.#changeHistory.splice(0, HISTORY_SIZE / 2);
    }
  }
}
