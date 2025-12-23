import { GitLabProject } from '../../../common/platform/gitlab_project';
import { GetRequest } from '../../../common/platform/web_ide';

export const getProtectedBranches = (
  project: GitLabProject,
): GetRequest<RestProtectedBranch[]> => ({
  type: 'rest',
  method: 'GET',
  path: `/projects/${project.restId}/protected_branches`,
});
