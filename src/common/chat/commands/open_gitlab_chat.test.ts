import { GitLabChatController } from '../gitlab_chat_controller';
import { openGitLabChat } from './open_gitlab_chat';

describe('openGitLabChat', () => {
  let controller: GitLabChatController;

  beforeEach(() => {
    controller = {
      openChat: jest.fn(),
    } as unknown as Partial<GitLabChatController> as GitLabChatController;
  });

  it('shows the view when command is executed', async () => {
    await openGitLabChat(controller);

    expect(controller.openChat).toHaveBeenCalled();
  });
});
