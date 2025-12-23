import { GitLabPlatformManager } from '../../platform/gitlab_platform';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { gitlabPlatformForAccount } from '../../test_utils/entities';
import { isDuoChatAvailable } from './chat_availability_utils';

const platformManagerForChatMock = {
  getGitLabPlatform: jest.fn(),
};

jest.mock('../get_platform_manager_for_chat', () => ({
  GitLabPlatformManagerForChat: jest.fn().mockImplementation(() => platformManagerForChatMock),
}));

describe('isDuoChatAvailable', () => {
  let manager: GitLabPlatformManager;

  beforeEach(() => {
    manager = createFakePartial<GitLabPlatformManager>({});
  });

  it('returns true if there is a platform for chat', async () => {
    platformManagerForChatMock.getGitLabPlatform = jest
      .fn()
      .mockResolvedValue(gitlabPlatformForAccount);
    await expect(isDuoChatAvailable(manager)).resolves.toBe(true);
  });

  it('returns false if there is no platform for chat', async () => {
    platformManagerForChatMock.getGitLabPlatform = jest.fn().mockResolvedValue(undefined);
    await expect(isDuoChatAvailable(manager)).resolves.toBe(false);
  });

  it('is false if getGitLabPlatform() fails', async () => {
    platformManagerForChatMock.getGitLabPlatform = jest.fn().mockRejectedValue(undefined);
    await expect(isDuoChatAvailable(manager)).resolves.toBe(false);
  });
});
