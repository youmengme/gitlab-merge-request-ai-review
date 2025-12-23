import { GitLabProject } from '../../../common/platform/gitlab_project';
import { GetRequest } from '../../../common/platform/web_ide';

export const getOpenMergeRequestsForBranch = (
  project: GitLabProject,
  sourceBranch: string,
): GetRequest<RestMr[]> => ({
  type: 'rest',
  method: 'GET',
  path: `/projects/${project.restId}/merge_requests`,
  searchParams: { state: 'opened', source_branch: sourceBranch },
});
