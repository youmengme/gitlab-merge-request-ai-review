import {
  GitLabPlatformForAccount,
  GitLabPlatformForProject,
  GitLabPlatformManager,
} from '../platform/gitlab_platform';
import { account, gitlabPlatformForAccount } from '../test_utils/entities';
import { Account } from '../platform/gitlab_account';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { GitLabProject } from '../platform/gitlab_project';
import { getChatSupport } from './api/get_chat_support';
import { GitLabPlatformManagerForChat } from './get_platform_manager_for_chat';

jest.mock('../utils/extension_configuration');
jest.mock('./api/get_chat_support', () => ({
  getChatSupport: jest.fn(),
}));

describe('GitLabPlatformManagerForChat', () => {
  let platformManagerForChat: GitLabPlatformManagerForChat;
  let gitlabPlatformManager: GitLabPlatformManager;

  const buildGitLabPlatformForAccount = (useAccount: Account): GitLabPlatformForAccount => ({
    ...gitlabPlatformForAccount,
    account: useAccount,
  });

  const firstGitlabPlatformForAccount: GitLabPlatformForAccount = buildGitLabPlatformForAccount({
    ...account,
    username: 'first-account',
  });

  beforeEach(() => {
    gitlabPlatformManager = createFakePartial<GitLabPlatformManager>({
      getForActiveProject: jest.fn(),
      getForActiveAccount: jest.fn(),
    });

    platformManagerForChat = new GitLabPlatformManagerForChat(gitlabPlatformManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    jest
      .mocked(gitlabPlatformManager.getForActiveAccount)
      .mockResolvedValue(firstGitlabPlatformForAccount);
  });

  it('returns the same platform as the platform manager if chat is supported', async () => {
    jest.mocked(getChatSupport).mockResolvedValue({ hasSupportForChat: true });

    const platform = await platformManagerForChat.getGitLabPlatform();

    expect(platform).toBe(firstGitlabPlatformForAccount);
  });

  it('returns undefined if the chat is not supported', async () => {
    jest.mocked(getChatSupport).mockResolvedValue({ hasSupportForChat: false });

    const platform = await platformManagerForChat.getGitLabPlatform();

    expect(platform).toBe(undefined);
  });

  describe('getGqlProjectId', () => {
    it('should return a project when it exists', async () => {
      const projectGqlId = 'gid://gitlab/Project/123456';
      const createPartialGitLabPlatformForProject = () =>
        createFakePartial<GitLabPlatformForProject>({
          project: createFakePartial<GitLabProject>({
            gqlId: projectGqlId,
          }),
        });
      jest
        .mocked(gitlabPlatformManager.getForActiveProject)
        .mockResolvedValueOnce(createPartialGitLabPlatformForProject());

      const projectId = await platformManagerForChat.getProjectGqlId();

      expect(projectId).toBe(projectGqlId);
    });

    it(`should return undefined when a project doesn't exist`, async () => {
      jest.mocked(gitlabPlatformManager.getForActiveProject).mockResolvedValueOnce(undefined);

      const projectId = await platformManagerForChat.getProjectGqlId();

      expect(projectId).toBe(undefined);
    });
  });
});
