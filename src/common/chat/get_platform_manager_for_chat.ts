import { GitLabPlatformManager, GitLabPlatformForAccount } from '../platform/gitlab_platform';
import { getEnvironment, GitLabEnvironment } from '../snowplow/get_environment';
import { getChatSupport } from './api/get_chat_support';

export class GitLabPlatformManagerForChat {
  readonly #platformManager: GitLabPlatformManager;

  constructor(platformManager: GitLabPlatformManager) {
    this.#platformManager = platformManager;
  }

  async getProjectGqlId(): Promise<string | undefined> {
    const projectManager = await this.#platformManager.getForActiveProject(false);
    return projectManager?.project.gqlId;
  }

  /**
   * Obtains a GitLab Platform to send API requests to the GitLab API
   * for the Duo Chat feature.
   *
   * - It returns a GitLabPlatformForAccount for the first linked account.
   * - It returns undefined if there are no accounts linked
   */
  async getGitLabPlatform(): Promise<GitLabPlatformForAccount | undefined> {
    const activeAccountPlatform = await this.#platformManager.getForActiveAccount(false);
    // FIXME: checking chat support here is a workaround because when we disable LS (in WebIDE)
    // we don't have the feature state check available to tell us chat is disabled
    // fix would be to implement the check differently in the gitlab_chat.ts where we are setting the context value for chat
    const result = await getChatSupport(activeAccountPlatform);
    return result.hasSupportForChat ? activeAccountPlatform : undefined;
  }

  async getGitLabEnvironment(): Promise<GitLabEnvironment> {
    const platform = await this.getGitLabPlatform();
    if (!platform) return GitLabEnvironment.GITLAB_SELF_MANAGED;
    const instanceUrl = platform?.account.instanceUrl;
    return getEnvironment(instanceUrl);
  }
}
