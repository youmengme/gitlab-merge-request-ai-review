import * as vscode from 'vscode';
import { createMockTextDocument } from '../../__mocks__/mock_text_document';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import {
  getActiveEditorText,
  getSelectedText,
  getFileName,
  getTextBeforeSelected,
  getTextAfterSelected,
} from './editor_text_utils';

const documentLinesCount = 40;
const documentLastCharacterNumber = 10;

describe('editor_text_utils', () => {
  describe('getActiveEditorText', () => {
    it('returns null if there is no active editor', () => {
      vscode.window.activeTextEditor = undefined;

      expect(getActiveEditorText()).toBe(null);
    });

    it('returns document content if there is an active editor', () => {
      vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
        document: createFakePartial<vscode.TextDocument>({
          getText: jest.fn().mockReturnValue('editorText'),
        }),
      });

      expect(getActiveEditorText()).toStrictEqual('editorText');
    });
  });

  describe('getSelectedText', () => {
    it('returns text from the document for the given range', () => {
      const document = createFakePartial<vscode.TextDocument>({
        getText: jest.fn().mockReturnValue('selected text'),
      });
      const selectionRange = new vscode.Range(1, 2, 3, 4);

      const result = getSelectedText(document, selectionRange);

      expect(document.getText).toHaveBeenCalledWith(selectionRange);
      expect(result).toBe('selected text');
    });
  });

  describe('getFileName', () => {
    it('returns the relative path of the document', () => {
      const relativePath = 'gitlab/foo/bar.rb';
      const fullPath = `/Users/dev/${relativePath}`;
      const asRelativePathMock = jest.fn().mockReturnValue(relativePath);

      const mockDocument = createFakePartial<vscode.TextDocument>({
        uri: fullPath,
      });

      vscode.workspace.asRelativePath = asRelativePathMock;

      expect(getFileName(mockDocument)).toStrictEqual(relativePath);
      expect(asRelativePathMock).toHaveBeenCalledWith(fullPath);
    });
  });

  describe('getTextBeforeSelected', () => {
    let document: vscode.TextDocument;

    beforeEach(() => {
      document = createMockTextDocument({
        content: Array.from({ length: documentLinesCount })
          .map(() => 'a'.repeat(documentLastCharacterNumber))
          .join('\n'),
      });
    });

    it.each`
      selectionRange                     | expectedRange
      ${new vscode.Range(0, 0, 0, 0)}    | ${new vscode.Range(0, 0, 0, 0)}
      ${new vscode.Range(0, 10, 1, 0)}   | ${new vscode.Range(0, 0, 0, 9)}
      ${new vscode.Range(10, 10, 20, 0)} | ${new vscode.Range(0, 0, 10, 9)}
      ${new vscode.Range(10, 0, 39, 0)}  | ${new vscode.Range(0, 0, 9, 10)}
      ${new vscode.Range(10, 5, 39, 6)}  | ${new vscode.Range(0, 0, 10, 4)}
    `('returns correct content before $selectionRange', ({ selectionRange, expectedRange }) => {
      getTextBeforeSelected(document, selectionRange);
      expect(document.getText).toHaveBeenCalledWith(expectedRange);
    });
  });

  describe('getTextAfterSelected', () => {
    let document: vscode.TextDocument;

    beforeEach(() => {
      document = createMockTextDocument({
        content: Array.from({ length: documentLinesCount })
          .map(() => 'a'.repeat(documentLastCharacterNumber))
          .join('\n'),
      });
    });

    it.each`
      selectionRange                      | expectedRange
      ${new vscode.Range(10, 10, 20, 5)}  | ${new vscode.Range(20, 6, 39, 10)}
      ${new vscode.Range(10, 10, 20, 10)} | ${new vscode.Range(21, 0, 39, 10)}
      ${new vscode.Range(10, 10, 20, 0)}  | ${new vscode.Range(20, 1, 39, 10)}
      ${new vscode.Range(10, 10, 39, 10)} | ${new vscode.Range(39, 10, 39, 10)}
      ${new vscode.Range(10, 10, 39, 0)}  | ${new vscode.Range(39, 1, 39, 10)}
    `('returns correct content after $selectionRange', ({ selectionRange, expectedRange }) => {
      getTextAfterSelected(document, selectionRange);
      expect(document.getText).toHaveBeenCalledWith(expectedRange);
    });
  });
});
