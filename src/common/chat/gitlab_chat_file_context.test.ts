import vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { getActiveFileContext, getFileContext } from './gitlab_chat_file_context';
import {
  getSelectedText,
  getFileName,
  getTextAfterSelected,
  getTextBeforeSelected,
  getActiveSelectionRange,
} from './utils/editor_text_utils';

jest.mock('./utils/editor_text_utils');

describe('gitlab_chat_file_context', () => {
  const mockDocument = createFakePartial<vscode.TextDocument>({ uri: 'file://test.ts' });
  const mockRange = new vscode.Range(0, 0, 1, 0);

  beforeEach(() => {
    jest.mocked(getSelectedText).mockReturnValue('selectedText');
    jest.mocked(getFileName).mockReturnValue('filename');
    jest.mocked(getTextBeforeSelected).mockReturnValue('textBeforeSelection');
    jest.mocked(getTextAfterSelected).mockReturnValue('textAfterSelection');
    jest.mocked(getActiveSelectionRange).mockReturnValue(mockRange);
  });

  describe('getFileContext', () => {
    it('returns undefined when no text is selected', () => {
      jest.mocked(getSelectedText).mockReturnValue('');

      expect(getFileContext(mockDocument, mockRange)).toBeUndefined();
      expect(getSelectedText).toHaveBeenCalledWith(mockDocument, mockRange);
    });

    it('returns undefined when no filename is available', () => {
      jest.mocked(getFileName).mockReturnValue('');

      expect(getFileContext(mockDocument, mockRange)).toBeUndefined();
      expect(getFileName).toHaveBeenCalledWith(mockDocument);
    });

    it('returns correctly populated context when all data is available', () => {
      const context = getFileContext(mockDocument, mockRange);

      expect(context).toEqual({
        selectedText: 'selectedText',
        fileName: 'filename',
        contentAboveCursor: 'textBeforeSelection',
        contentBelowCursor: 'textAfterSelection',
      });

      expect(getSelectedText).toHaveBeenCalledWith(mockDocument, mockRange);
      expect(getFileName).toHaveBeenCalledWith(mockDocument);
      expect(getTextBeforeSelected).toHaveBeenCalledWith(mockDocument, mockRange);
      expect(getTextAfterSelected).toHaveBeenCalledWith(mockDocument, mockRange);
    });
  });

  describe('getActiveFileContext', () => {
    it('returns undefined when no active editor exists', () => {
      vscode.window.activeTextEditor = undefined;

      expect(getActiveFileContext()).toBeUndefined();
    });

    it('returns undefined when no document exists', () => {
      vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
        document: undefined,
      });

      expect(getActiveFileContext()).toBeUndefined();
    });

    it('returns undefined when no selection range exists', () => {
      vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
        document: mockDocument,
        selection: undefined,
      });

      jest.mocked(getActiveSelectionRange).mockReturnValue(null);

      expect(getActiveFileContext()).toBeUndefined();
      expect(getActiveSelectionRange).toHaveBeenCalled();
    });

    it('returns correctly populated context when all data is available', () => {
      vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
        document: mockDocument,
      });

      const context = getActiveFileContext();

      expect(context).toEqual({
        selectedText: 'selectedText',
        fileName: 'filename',
        contentAboveCursor: 'textBeforeSelection',
        contentBelowCursor: 'textAfterSelection',
      });

      expect(getSelectedText).toHaveBeenCalledWith(mockDocument, mockRange);
      expect(getFileName).toHaveBeenCalledWith(mockDocument);
      expect(getTextBeforeSelected).toHaveBeenCalledWith(mockDocument, mockRange);
      expect(getTextAfterSelected).toHaveBeenCalledWith(mockDocument, mockRange);
    });
  });
});
