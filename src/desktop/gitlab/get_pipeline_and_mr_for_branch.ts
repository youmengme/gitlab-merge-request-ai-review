import { log } from '../../common/log';
import { GitLabProject } from '../../common/platform/gitlab_project';
import { sort } from '../utils/sort';
import { getOpenMergeRequestsForBranch } from './api/get_open_merge_requests_for_branch';
import { getPipelinesForMr } from './api/get_pipelines_for_mr';
import { getPipelinesForRef } from './api/get_pipelines_for_ref';
import { GitLabService } from './gitlab_service';

// TODO: implement more granular approach to errors (deciding between expected and critical)
const turnErrorToUndefined: <T>(p: Promise<T>) => Promise<T | undefined> = p =>
  p.catch(e => {
    log.error(e);
    return undefined;
  });

export const getPipelineAndMrForBranch = async (
  gitlabService: GitLabService,
  project: GitLabProject,
  trackingBranchName: string,
): Promise<{
  pipeline?: RestPipeline;
  mr?: RestMr;
}> => {
  const mr = (
    await turnErrorToUndefined(
      gitlabService.fetchFromApi(getOpenMergeRequestsForBranch(project, trackingBranchName)),
    )
  )?.[0];
  if (mr) {
    const pipelines = await turnErrorToUndefined(gitlabService.fetchFromApi(getPipelinesForMr(mr)));
    if (pipelines && pipelines.length > 0) {
      const pipeline = sort(pipelines, (p1, p2) => p2.iid - p1.iid)[0];
      return { mr, pipeline };
    }
  }
  const pipelines = await turnErrorToUndefined(
    gitlabService.fetchFromApi(getPipelinesForRef(project, trackingBranchName)),
  );
  return { mr, pipeline: pipelines?.[0] };
};
