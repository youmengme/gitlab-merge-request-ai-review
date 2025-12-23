import * as vscode from 'vscode';
import { getActiveProject, getActiveProjectOrSelectOne } from '../commands/run_with_valid_project';
import {
  GitLabPlatformForAccount,
  GitLabPlatformManager,
} from '../../common/platform/gitlab_platform';
import { Account, serializeAccountSafe } from '../../common/platform/gitlab_account';
import { getWorkspaceAccountManager } from '../accounts/workspace_account_manager';
import { accountService } from '../accounts/account_service';
import { log } from '../../common/log';
import { extensionConfigurationService } from '../../common/utils/extension_configuration_service';
import { doNotAwait } from '../../common/utils/do_not_await';
import { getGitLabServiceForAccount } from './get_gitlab_service';
import { ProjectInRepository } from './new_project';
import { getUserAgentHeader } from './http/get_user_agent_header';
import { getProjectRepository } from './gitlab_project_repository';

let inconsistencyWarningShown = false;

const getProjectInRepository = async (userInitiated: boolean) => {
  let projectInRepository: ProjectInRepository | undefined;
  if (userInitiated) {
    projectInRepository = await getActiveProjectOrSelectOne();
  } else {
    projectInRepository = getActiveProject();
  }

  return projectInRepository;
};

function createGitLabPlatformForAccount(account: Account): GitLabPlatformForAccount {
  return {
    type: 'account',
    account,
    project: undefined,
    fetchFromApi: async req => getGitLabServiceForAccount(account).fetchFromApi(req),
    connectToCable: async () => getGitLabServiceForAccount(account).connectToCable(),
    getUserAgentHeader,
  };
}

export const gitlabPlatformManagerDesktop: GitLabPlatformManager = {
  getForActiveProject: async userInitiated => {
    const projectInRepository = await getProjectInRepository(userInitiated);
    if (!projectInRepository) {
      return undefined;
    }
    const upToDateAccount = await accountService.getAccount(projectInRepository.account.id);
    if (!upToDateAccount) {
      log.error(
        `[GitLabPlatformManagerDesktop][auth] The account ${projectInRepository.account.id} no longer exists`,
      );
      return undefined;
    }
    if (upToDateAccount.token !== projectInRepository.account.token) {
      log.warn(
        `[auth] The token stored in project repository is out of date with the main VS Code storage` +
          `ProjectRepository account ${serializeAccountSafe(projectInRepository.account)}` +
          `VS Code storage account ${serializeAccountSafe(upToDateAccount)}`,
      );
      if (extensionConfigurationService.getConfiguration().debug && !inconsistencyWarningShown) {
        inconsistencyWarningShown = true;
        doNotAwait(
          vscode.window.showWarningMessage(
            'We noticed and fixed inconsistency in the GitLab account cache. The extension will continue working as expected. ' +
              'We cannot reliably reproduce this inconsistency, please help us by adding a comment to [this issue](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/1935) ' +
              'with [your logs](https://docs.gitlab.com/editor_extensions/visual_studio_code/troubleshooting/#view-log-files) from all running VS Code windows',
          ),
        );
      }
    }
    return {
      type: 'project',
      account: upToDateAccount,
      project: projectInRepository.project,
      fetchFromApi: async req => getGitLabServiceForAccount(upToDateAccount).fetchFromApi(req),
      connectToCable: async () => getGitLabServiceForAccount(upToDateAccount).connectToCable(),
      getUserAgentHeader,
    };
  },

  getForActiveAccount: async () => {
    const { activeAccount } = getWorkspaceAccountManager();
    return activeAccount && createGitLabPlatformForAccount(activeAccount);
  },

  // This is tricky
  // The project repository caches accounts.
  // When account changes, project repository updates this cache, but it takes long time
  // because it has to do several API requests. Until the API calls are done, the account cache is stale.
  // If we listened on accountChange here, results of the platform.getForActiveProject() method wouldn't
  // be guaranteed to have the up-to-date account because the platform uses project repository.
  // That's why we have to listen on project repository and not on account changes.
  // See sequence diagrams: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/1174#note_1658575653
  onAccountChange: listener =>
    vscode.Disposable.from(getProjectRepository().onProjectChange(() => listener())),
};
