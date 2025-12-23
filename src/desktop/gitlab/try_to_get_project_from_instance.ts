import { Account } from '../../common/platform/gitlab_account';
import { log } from '../../common/log';
import { convertToGitLabProject, getProject } from '../../common/gitlab/api/get_project';
import { GitLabProject } from '../../common/platform/gitlab_project';
import { getGitLabServiceForAccount } from './get_gitlab_service';

export const tryToGetProjectFromInstance = async (
  account: Account,
  namespaceWithPath: string,
): Promise<GitLabProject | undefined> => {
  const { project } = await getGitLabServiceForAccount(account)
    .fetchFromApi(getProject(namespaceWithPath))
    .catch(e => {
      log.error(e);
      return { project: undefined };
    });

  return project && convertToGitLabProject(project);
};
