import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { gitlabPlatformForAccount, gitlabPlatformForProject } from '../test_utils/entities';
import { createFakePartial } from '../test_utils/create_fake_partial';
import {
  GitLabPlatformManagerForCodeSuggestions,
  GitLabPlatformManagerForCodeSuggestionsImpl,
} from './gitlab_platform_manager_for_code_suggestions';

describe('code_suggestions/GitLabPlatformForCodeSuggestions', () => {
  let platformManagerForCodeSuggestions: GitLabPlatformManagerForCodeSuggestions;
  let gitlabPlatformManager: GitLabPlatformManager;

  beforeEach(() => {
    gitlabPlatformManager = createFakePartial<GitLabPlatformManager>({
      getForActiveProject: jest.fn(),
      getForActiveAccount: jest.fn(),
      onAccountChange: jest.fn().mockReturnValue({ dispose: () => {} }),
    });

    platformManagerForCodeSuggestions = new GitLabPlatformManagerForCodeSuggestionsImpl(
      gitlabPlatformManager,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    jest
      .mocked(gitlabPlatformManager.getForActiveProject)
      .mockResolvedValue(gitlabPlatformForProject);
    jest
      .mocked(gitlabPlatformManager.getForActiveAccount)
      .mockResolvedValue(gitlabPlatformForAccount);
  });

  it('tries to return project platform first', async () => {
    const platform = await platformManagerForCodeSuggestions.getGitLabPlatform();

    expect(platform).toBe(gitlabPlatformForProject);
  });

  it('returns account platform if project platform does not exist', async () => {
    jest.mocked(gitlabPlatformManager.getForActiveProject).mockResolvedValue(undefined);

    const platform = await platformManagerForCodeSuggestions.getGitLabPlatform();

    expect(platform).toBe(gitlabPlatformForAccount);
  });
});
