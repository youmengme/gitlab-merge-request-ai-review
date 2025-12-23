import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { GitLabService } from '../gitlab/gitlab_service';
import { job, pipeline, projectInRepository } from '../test_utils/entities';
import { PipelineItemModel } from '../tree_view/items/pipeline_item_model';
import { cancelPipeline, retryPipeline } from './pipeline_actions';

jest.mock('../gitlab/get_gitlab_service');

describe('retryOrCancelPipeline', () => {
  const item = new PipelineItemModel(projectInRepository, pipeline, [job]);
  const gitLabService = createFakePartial<GitLabService>({
    cancelOrRetryPipeline: jest.fn(),
  });

  beforeEach(() => {
    jest.mocked(getGitLabService).mockReturnValue(gitLabService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('can retry pipelines', async () => {
    await retryPipeline(item);

    expect(gitLabService.cancelOrRetryPipeline).toHaveBeenCalledWith(
      'retry',
      projectInRepository.project,
      pipeline,
    );
  });

  it('can cancel pipelines', async () => {
    await cancelPipeline(item);

    expect(gitLabService.cancelOrRetryPipeline).toHaveBeenCalledWith(
      'cancel',
      projectInRepository.project,
      pipeline,
    );
  });
});
