import { GitLabChatController } from '../gitlab_chat_controller';
import { focusGitLabChat } from './focus_gitlab_chat';

describe('focusGitLabChat', () => {
  let controller: GitLabChatController;

  beforeEach(() => {
    controller = {
      focusChat: jest.fn(),
    } as unknown as Partial<GitLabChatController> as GitLabChatController;
  });

  it('focuses the view prompt when command is executed', async () => {
    await focusGitLabChat(controller);

    expect(controller.focusChat).toHaveBeenCalled();
  });
});
