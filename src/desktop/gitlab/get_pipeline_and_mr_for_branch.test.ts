import { createFakeFetchFromApi } from '../../common/test_utils/create_fake_fetch_from_api';
import { project } from '../../common/test_utils/entities';
import { mr, pipeline } from '../test_utils/entities';
import { getOpenMergeRequestsForBranch } from './api/get_open_merge_requests_for_branch';
import { getPipelinesForMr } from './api/get_pipelines_for_mr';
import { getPipelinesForRef } from './api/get_pipelines_for_ref';
import { getPipelineAndMrForBranch } from './get_pipeline_and_mr_for_branch';
import { GitLabService } from './gitlab_service';

describe('getPipelineAndMrForBranch', () => {
  describe('when branch has an associated merge request', () => {
    it('returns MR pipeline with largest iid', async () => {
      const fakeService = new GitLabService({ instanceUrl: '', token: '' });
      const branchName = 'branch-name';

      jest.spyOn(fakeService, 'fetchFromApi').mockImplementation(
        createFakeFetchFromApi(
          { request: getOpenMergeRequestsForBranch(project, branchName), response: [mr] },
          {
            request: getPipelinesForMr(mr),
            response: [
              { ...pipeline, iid: 1 },
              { ...pipeline, iid: 2 },
            ],
          },
        ),
      );

      const { pipeline: p } = await getPipelineAndMrForBranch(fakeService, project, branchName);

      expect(p?.iid).toBe(2);
    });
  });

  describe('when branch does not have an associated merge request', () => {
    it('returns no MR and pipeline for a branch', async () => {
      const fakeService = new GitLabService({ instanceUrl: '', token: '' });
      const branchName = 'branch-name';

      jest.spyOn(fakeService, 'fetchFromApi').mockImplementation(
        createFakeFetchFromApi(
          { request: getOpenMergeRequestsForBranch(project, branchName), response: [] },
          {
            request: getPipelinesForRef(project, branchName),
            response: [
              { ...pipeline, iid: 1 },
              { ...pipeline, iid: 2 },
            ],
          },
        ),
      );

      const { pipeline: p, mr: m } = await getPipelineAndMrForBranch(
        fakeService,
        project,
        branchName,
      );

      expect(m).toBeUndefined();
      expect(p?.iid).toBe(1);
    });
  });
});
