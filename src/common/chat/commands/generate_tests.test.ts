import { join } from 'path';
import * as vscode from 'vscode';
import { createMockTextDocument } from '../../__mocks__/mock_text_document';
import { asMutable } from '../../test_utils/types';
import { GitLabChatController } from '../gitlab_chat_controller';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { generateTests } from './generate_tests';

let selectedTextValue: string | null = 'selectedText';
const filenameValue = 'filename';
const mockSelectionRange = new vscode.Range(0, 0, 1, 1);

jest.mock('../utils/editor_text_utils', () => ({
  getActiveSelectionRange: jest.fn().mockImplementation(() => mockSelectionRange),
  getSelectedText: jest.fn().mockImplementation(() => selectedTextValue),
  getFileName: jest.fn().mockImplementation(() => filenameValue),
  getTextAfterSelected: jest.fn().mockReturnValue('textAfterSelection'),
  getTextBeforeSelected: jest.fn().mockReturnValue('textBeforeSelection'),
}));

describe('generateTests', () => {
  let controller: GitLabChatController;

  beforeEach(() => {
    asMutable(vscode.window).activeTextEditor = createFakePartial<vscode.TextEditor>({
      document: createMockTextDocument({
        uri: vscode.Uri.file(join('some', 'path', filenameValue)),
        content: 'full document content\nsecond line\nthird line',
      }),
      selection: mockSelectionRange,
    });

    controller = createFakePartial<GitLabChatController>({
      processNewUserRecord: jest.fn(),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates new "Generate tests" record with selection', async () => {
    selectedTextValue = 'hello';

    await generateTests(controller);
    expect(controller.processNewUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '/tests',
        role: 'user',
        type: 'generateTests',
        context: {
          currentFile: {
            selectedText: selectedTextValue,
            fileName: filenameValue,
            contentAboveCursor: 'textBeforeSelection',
            contentBelowCursor: 'textAfterSelection',
          },
        },
      }),
    );
  });

  it('does not create new "Generate tests" record if there is no active editor', async () => {
    vscode.window.activeTextEditor = undefined;

    await generateTests(controller);

    expect(controller.processNewUserRecord).not.toHaveBeenCalled();
  });

  it('does not create new "Generate tests" record if there is no selected text', async () => {
    selectedTextValue = '';

    await generateTests(controller);

    expect(controller.processNewUserRecord).not.toHaveBeenCalled();
  });
});
