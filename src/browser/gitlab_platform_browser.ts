import type {
  GitLabPlatformForAccount,
  GitLabPlatformManager,
} from '../common/platform/gitlab_platform';
import type { WebIDEExtension } from '../common/platform/web_ide';
import { convertToGitLabProject, getProject } from '../common/gitlab/api/get_project';
import { currentUserRequest } from '../common/gitlab/api/get_current_user';
import type { TokenAccount } from '../common/platform/gitlab_account';
import { connectToCable } from '../common/gitlab/api/action_cable';
import type { ApiClient } from '../common/gitlab/api/api_client';
import type { Authentication } from './auth';
import { resolveAuthentication } from './auth';
import { createApiClient } from './api';

const createAccountPlatform = (
  user: RestUser,
  gitlabUrl: string,
  authentication: Authentication,
  apiClient: ApiClient,
): GitLabPlatformForAccount => {
  const token = authentication.getSession().accessToken;

  const account: TokenAccount = {
    type: 'token',
    username: user.username,
    id: `${user.id}`,
    token,
    instanceUrl: gitlabUrl,
  };

  return {
    type: 'account',
    fetchFromApi: apiClient.fetchFromApi.bind(apiClient),
    connectToCable: async () => connectToCable(account.instanceUrl),
    // browser won't let us change User-Agent header
    // so we don't have to construct it
    getUserAgentHeader: () => ({}),
    account,
    project: undefined,
  };
};

export const createGitLabPlatformManagerBrowser = async ({
  projectPath,
  gitlabUrl,
}: WebIDEExtension): Promise<GitLabPlatformManager> => {
  const authentication = await resolveAuthentication();

  const apiClient = createApiClient(gitlabUrl, authentication);

  const { project } = await apiClient.fetchFromApi(getProject(projectPath));
  if (!project) {
    throw new Error(`GitLab API returned empty response when asked for ${projectPath} project.`);
  }

  const user = await apiClient.fetchFromApi(currentUserRequest);
  if (!user) {
    throw new Error(`GitLab API returned empty response when asked for the current user.`);
  }

  const gitLabProject = convertToGitLabProject(project);

  let accountPlatform = createAccountPlatform(user, gitlabUrl, authentication, apiClient);
  authentication.onChange(() => {
    accountPlatform = createAccountPlatform(user, gitlabUrl, authentication, apiClient);
  });

  return {
    getForActiveProject: () =>
      Promise.resolve({
        ...accountPlatform,
        type: 'project',
        project: gitLabProject,
      }),
    getForActiveAccount: async () => accountPlatform,
    onAccountChange: authentication.onChange,
  };
};
