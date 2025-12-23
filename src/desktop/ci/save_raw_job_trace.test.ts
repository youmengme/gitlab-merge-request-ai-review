import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { GitLabService } from '../gitlab/gitlab_service';
import { getProjectRepository, GitLabProjectRepository } from '../gitlab/gitlab_project_repository';
import { projectInRepository } from '../test_utils/entities';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { toJobLogUri } from './job_log_uri';
import { jobLogCache } from './job_log_cache';
import { saveRawJobTrace } from './save_raw_job_trace';

jest.mock('../gitlab/get_gitlab_service');
jest.mock('../gitlab/gitlab_project_repository');

describe('saveRawJobTrace', () => {
  const uri = toJobLogUri('/repo', 123, 123);

  beforeEach(async () => {
    jest.mocked(vscode.window.showSaveDialog).mockResolvedValue(vscode.Uri.file('job.log'));
    jest.mocked(getProjectRepository).mockReturnValue(
      createFakePartial<GitLabProjectRepository>({
        getProjectOrFail: jest.fn().mockReturnValue(projectInRepository),
      }),
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
    jobLogCache.clearAll();
  });

  it('saves the log from the API', async () => {
    const rawTrace = await fs.readFile(
      path.join(__dirname, '..', 'test_utils', 'raw_trace.log'),
      'utf-8',
    );

    const gitlabService = createFakePartial<GitLabService>({
      async getJobTrace(): Promise<{ rawTrace: string; eTag: string }> {
        return { rawTrace, eTag: '' };
      },
    });
    jest.mocked(getGitLabService).mockReturnValue(gitlabService);
    await saveRawJobTrace(uri);
    expect(vscode.workspace.fs.writeFile).toBeCalled();
  });

  it('saves the log from the cache', async () => {
    const gitlabService = createFakePartial<GitLabService>({
      getJobTrace(): Promise<{ rawTrace: string; eTag: string }> {
        return Promise.reject();
      },
    });
    jest.mocked(getGitLabService).mockReturnValue(gitlabService);
    jobLogCache.set(123, 'content');

    await saveRawJobTrace(uri);
    expect(vscode.workspace.fs.writeFile).toBeCalled();
  });
});
