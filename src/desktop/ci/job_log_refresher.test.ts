import { currentBranchRefresher } from '../current_branch_refresher';
import { getProjectRepository, GitLabProjectRepository } from '../gitlab/gitlab_project_repository';
import { projectInRepository } from '../test_utils/entities';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { GitLabService } from '../gitlab/gitlab_service';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { JobLogRefresher } from './job_log_refresher';
import { jobLogCache } from './job_log_cache';

jest.mock('../current_branch_refresher');
jest.mock('../gitlab/get_gitlab_service');
jest.mock('../gitlab/gitlab_project_repository');

describe('JobLogRefresher', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(currentBranchRefresher.refresh).mockResolvedValue(undefined);
    jest.mocked(getProjectRepository).mockReturnValue(
      createFakePartial<GitLabProjectRepository>({
        getProjectOrFail: jest.fn().mockReturnValue(projectInRepository),
      }),
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.resetAllMocks();
    jobLogCache.clearAll();
  });

  it('updates the cache', async () => {
    const gitlabService = createFakePartial<GitLabService>({
      getJobTrace: jest.fn().mockResolvedValue({ rawTrace: 'new trace', eTag: 'eTag 2' }),
    });
    jest.mocked(getGitLabService).mockReturnValue(gitlabService);

    jobLogCache.setForRunning('root', 123, 'raw trace', 'eTag');

    jobLogCache.startRefreshing(123, 123);

    jest.advanceTimersToNextTimer();

    expect(gitlabService.getJobTrace).toBeCalled();

    jobLogCache.stopRefreshing(123);

    expect(jest.getTimerCount()).toBe(0);
  });

  it('aborts when cache is missing', async () => {
    // eslint-disable-next-line no-new
    new JobLogRefresher(jobLogCache, 123, 123);

    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersToNextTimer();

    expect(jest.getTimerCount()).toBe(0);
  });
});
