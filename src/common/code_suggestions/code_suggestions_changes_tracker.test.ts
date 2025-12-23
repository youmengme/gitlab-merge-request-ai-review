import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import {
  DefaultCodeSuggestionsChangeTracker,
  SuggestionChangeType,
  CodeSuggestionsChangeTracker,
} from './code_suggestions_changes_tracker';

describe('CodeSuggestionsChangeTracker', () => {
  let subject: CodeSuggestionsChangeTracker;

  const createTextDocument = (params?: { uri?: vscode.Uri; text?: string }) =>
    createFakePartial<vscode.TextDocument>({
      uri: params?.uri || vscode.Uri.parse('file://file.js'),
      getText: jest.fn().mockReturnValue(params?.text || ''),
    });

  beforeEach(() => {
    subject = new DefaultCodeSuggestionsChangeTracker();
  });

  describe('lastChangeType', () => {
    describe('when delta between last two changes in negative', () => {
      it.each`
        positions                                                                                                       | document                               | result
        ${[new vscode.Position(1, 5), new vscode.Position(1, 4)]}                                                       | ${createTextDocument()}                | ${SuggestionChangeType.DeletedCharacter}
        ${[new vscode.Position(2, 5), new vscode.Position(1, 4)]}                                                       | ${createTextDocument()}                | ${SuggestionChangeType.Unknown}
        ${[new vscode.Position(1, 5), new vscode.Position(1, 5)]}                                                       | ${createTextDocument()}                | ${SuggestionChangeType.NoChange}
        ${[]}                                                                                                           | ${createTextDocument()}                | ${SuggestionChangeType.NoChange}
        ${[]}                                                                                                           | ${createTextDocument()}                | ${SuggestionChangeType.NoChange}
        ${[new vscode.Position(1, 5), new vscode.Position(1, 6), new vscode.Position(1, 7), new vscode.Position(1, 8)]} | ${createTextDocument({ text: '   ' })} | ${SuggestionChangeType.RepeatedSpaces}
        ${[new vscode.Position(1, 5), new vscode.Position(1, 6), new vscode.Position(1, 7), new vscode.Position(1, 8)]} | ${createTextDocument({ text: '  a' })} | ${SuggestionChangeType.Unknown}
        ${[new vscode.Position(1, 5), new vscode.Position(1, 6), new vscode.Position(1, 7), new vscode.Position(2, 8)]} | ${createTextDocument({ text: '   ' })} | ${SuggestionChangeType.Unknown}
      `('returns $result', ({ positions, document, result }) => {
        positions.forEach((position: vscode.Position) => {
          subject.trackCompletionRequest(document, position);
        });

        expect(subject.getLastChangeType(document)).toBe(result);
      });
    });
  });

  describe('garbage collection', () => {
    it('cleans half of the events history when the history is larger than 50', () => {
      const document = createTextDocument();
      for (let i = 0; i < 50; i += 1) {
        subject.trackCompletionRequest(document, new vscode.Position(i, i));
      }

      expect(subject.eventsHistorySize).toBe(50);

      subject.trackCompletionRequest(document, new vscode.Position(10, 10));

      expect(subject.eventsHistorySize).toBe(26);
    });
  });
});
