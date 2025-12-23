import { GitLabChatController } from '../gitlab_chat_controller';
import { closeGitLabChat } from './close_gitlab_chat';

describe('closeGitLabChat', () => {
  let controller: GitLabChatController;

  beforeEach(() => {
    controller = {
      closeChat: jest.fn(),
    } as unknown as Partial<GitLabChatController> as GitLabChatController;
  });

  it('closes the view when command is executed', async () => {
    await closeGitLabChat(controller);

    expect(controller.closeChat).toHaveBeenCalled();
  });
});
