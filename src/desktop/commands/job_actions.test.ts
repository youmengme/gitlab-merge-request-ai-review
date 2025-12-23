import { getGitLabService } from '../gitlab/get_gitlab_service';
import { job, projectInRepository } from '../test_utils/entities';
import { GitLabService } from '../gitlab/gitlab_service';
import { JobItemModel } from '../tree_view/items/job_item_model';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { cancelJob, executeJob, retryJob } from './job_actions';

jest.mock('../gitlab/get_gitlab_service');

describe('retryOrCancelJobItemModel', () => {
  const mockActions: Record<string, 'canceled' | 'pending'> = {
    cancel: 'canceled',
    retry: 'pending',
    play: 'pending',
  };
  const gitlabService = createFakePartial<GitLabService>({
    async cancelOrRetryJob(action: string, _, inputJob: RestJob): Promise<RestJob> {
      return { ...inputJob, status: mockActions[action] ?? 'skipped' };
    },
  });

  const model = new JobItemModel(projectInRepository, job);

  beforeEach(() => {
    jest.mocked(getGitLabService).mockReturnValue(gitlabService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('can cancel', async () => {
    const result = await cancelJob(model);
    expect(result?.status).toBe('canceled');
  });
  it('can retry', async () => {
    const result = await retryJob(model);
    expect(result?.status).toBe('pending');
  });
  it('can play', async () => {
    const result = await executeJob(model);
    expect(result?.status).toBe('pending');
  });
});
