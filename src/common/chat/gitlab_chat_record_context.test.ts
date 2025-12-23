import { buildCurrentContext } from './gitlab_chat_record_context';
import { GitLabChatFileContext } from './gitlab_chat_file_context';

let expectedCurrentFileContext: GitLabChatFileContext | undefined;

jest.mock('./gitlab_chat_file_context', () => ({
  getActiveFileContext: jest.fn().mockImplementation(() => expectedCurrentFileContext),
}));

describe('buildCurrentContext', () => {
  describe('with active file selection', () => {
    it('returns current file context', () => {
      expectedCurrentFileContext = {
        fileName: 'foo',
        selectedText: 'bar',
        contentAboveCursor: 'above',
        contentBelowCursor: 'below',
      };

      expect(buildCurrentContext()).toStrictEqual({
        currentFile: expectedCurrentFileContext,
      });
    });
  });

  it('is undefined without active file selection', () => {
    expectedCurrentFileContext = undefined;

    expect(buildCurrentContext()).toBeUndefined();
  });
});
