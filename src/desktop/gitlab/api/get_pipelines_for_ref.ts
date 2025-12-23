import { GitLabProject } from '../../../common/platform/gitlab_project';
import { GetRequest } from '../../../common/platform/web_ide';

export const getPipelinesForRef = (
  project: GitLabProject,
  ref: string,
): GetRequest<RestPipeline[]> => ({
  type: 'rest',
  method: 'GET',
  path: `/projects/${project.restId}/pipelines`,
  searchParams: { ref },
});
