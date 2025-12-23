import { createFakePartial } from '../common/test_utils/create_fake_partial';
import {
  extensionConfigurationService,
  ExtensionConfiguration,
} from '../common/utils/extension_configuration_service';
import { BranchState, CurrentBranchRefresher, TagState } from './current_branch_refresher';
import {
  pipeline,
  mr,
  issue,
  job,
  projectInRepository,
  externalStatus,
  securityReportComparer,
} from './test_utils/entities';
import { getGitLabService } from './gitlab/get_gitlab_service';
import { getTrackingBranchName } from './git/get_tracking_branch_name';
import { getTagsForHead } from './git/get_tags_for_head';
import { getPipelineAndMrForBranch } from './gitlab/get_pipeline_and_mr_for_branch';
import { getAllSecurityReports } from './gitlab/security_findings/get_all_security_reports';
import { GitLabService } from './gitlab/gitlab_service';

jest.mock('../common/utils/extension_configuration');
jest.mock('./gitlab/get_gitlab_service');
jest.mock('./git/get_tracking_branch_name');
jest.mock('./git/get_tags_for_head');
jest.mock('./gitlab/get_pipeline_and_mr_for_branch');
jest.mock('./gitlab/security_findings/get_all_security_reports');

describe('CurrentBranchRefrehser', () => {
  beforeEach(() => {
    jest
      .spyOn(extensionConfigurationService, 'getConfiguration')
      .mockReturnValue(createFakePartial<ExtensionConfiguration>({ featureFlags: {} }));
  });

  describe('invalid state', () => {
    it('returns invalid state if the current repo does not contain GitLab project', async () => {
      const state = await CurrentBranchRefresher.getState(undefined, false);
      expect(state.type).toBe('invalid');
    });

    it('returns invalid state if fetching the mr and pipelines fails', async () => {
      jest.mocked(getTrackingBranchName).mockResolvedValue('branch');
      const state = await CurrentBranchRefresher.getState(projectInRepository, false);
      expect(state.type).toBe('invalid');
    });
  });

  describe('valid state', () => {
    beforeEach(() => {
      jest.mocked(getGitLabService).mockReturnValue(
        createFakePartial<GitLabService>({
          getMrClosingIssues: async () => [createFakePartial<MinimalRestIssuable>({ iid: 123 })],
          getSingleProjectIssue: async () => issue,
          getJobsForPipeline: async () => [job],
          getTriggerJobsForPipeline: async () => [],
          getExternalStatusForCommit: async () => [externalStatus],
          fetchFromApi: async <T>() => [pipeline] as unknown as T,
        }),
      );

      jest.mocked(getPipelineAndMrForBranch).mockResolvedValue({ pipeline, mr });
    });

    it('returns valid state if GitLab service returns pipeline and mr', async () => {
      jest.mocked(getTrackingBranchName).mockResolvedValue('branch');
      const state = await CurrentBranchRefresher.getState(projectInRepository, false);

      const branchState = state as BranchState;
      expect(branchState.pipeline).toEqual(pipeline);
      expect(branchState.mr).toEqual(mr);
      expect(branchState.issues).toEqual([issue]);
      expect(branchState.securityFindings).toEqual(undefined);
    });

    it('returns valid state if GitLab service returns pipeline and mr and security scans', async () => {
      jest.mocked(getTrackingBranchName).mockResolvedValue('branch');
      jest.mocked(getAllSecurityReports).mockResolvedValue(securityReportComparer);

      const state = await CurrentBranchRefresher.getState(projectInRepository, false);

      const branchState = state as BranchState;
      expect(branchState.pipeline).toEqual(pipeline);
      expect(branchState.mr).toEqual(mr);
      expect(branchState.issues).toEqual([issue]);
      expect(branchState.securityFindings).toEqual(securityReportComparer);
    });

    it('returns valid state if repository has checked out a tag', async () => {
      jest.mocked(getTrackingBranchName).mockResolvedValue(undefined);
      jest.mocked(getTagsForHead).mockResolvedValue(['tag1']);
      const state = await CurrentBranchRefresher.getState(projectInRepository, false);

      expect(state.type).toBe('tag');
      expect((state as TagState).pipeline).toEqual(pipeline);
    });

    it('returns pipeline jobs and external statuses', async () => {
      jest.mocked(getTrackingBranchName).mockResolvedValue('branch');
      const state = await CurrentBranchRefresher.getState(projectInRepository, false);

      expect(state.type).toBe('branch');
      expect((state as BranchState).jobs).toEqual([job, externalStatus]);
    });
  });
});
