import * as vscode from 'vscode';
import { USER_COMMANDS } from '../command_names';
import { currentBranchRefresher, BranchState } from '../current_branch_refresher';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { GitLabService } from '../gitlab/gitlab_service';
import { job, pipeline, projectInRepository } from '../test_utils/entities';
import { triggerPipelineAction } from './trigger_pipeline_action';

jest.mock('../current_branch_refresher');
jest.mock('../gitlab/get_gitlab_service');

describe('triggerPipelineAction', () => {
  const jobs = [job];
  const gitLabService = createFakePartial<GitLabService>({
    cancelOrRetryPipeline: jest.fn(),
  });

  beforeEach(() => {
    const branchState: BranchState = {
      type: 'branch',
      issues: [],
      jobs,
      userInitiated: false,
      projectInRepository,
      pipeline,
    };
    jest.mocked(currentBranchRefresher.getOrRetrieveState).mockResolvedValue(branchState);
    jest.mocked(getGitLabService).mockReturnValue(gitLabService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('can download artifacts', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.mocked(vscode.window.showQuickPick).mockImplementation(items => (items as any)[1]);

    await triggerPipelineAction(projectInRepository);
    expect(vscode.commands.executeCommand).toHaveBeenCalled();

    const [command, jobProvider] = jest.mocked(vscode.commands.executeCommand).mock.lastCall ?? [];
    expect(command).toBe(USER_COMMANDS.DOWNLOAD_ARTIFACTS);
    expect(jobProvider.jobs).toBe(jobs);
  });

  it('can retry pipelines', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.mocked(vscode.window.showQuickPick).mockImplementation(options => (options as any)[3]);

    await triggerPipelineAction(projectInRepository);
    expect(vscode.commands.executeCommand).toHaveBeenCalled();

    const [command, itemModel] = jest.mocked(vscode.commands.executeCommand).mock.lastCall ?? [];
    expect(command).toBe(USER_COMMANDS.RETRY_FAILED_PIPELINE_JOBS);
    expect(itemModel.pipeline).toBe(pipeline);
  });

  it('can cancel pipelines', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.mocked(vscode.window.showQuickPick).mockImplementation(options => (options as any)[4]);

    await triggerPipelineAction(projectInRepository);
    expect(vscode.commands.executeCommand).toHaveBeenCalled();

    const [command, itemModel] = jest.mocked(vscode.commands.executeCommand).mock.lastCall ?? [];
    expect(command).toBe(USER_COMMANDS.CANCEL_PIPELINE);
    expect(itemModel.pipeline).toBe(pipeline);
  });
});
