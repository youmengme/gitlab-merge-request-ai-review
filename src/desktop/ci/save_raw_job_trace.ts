import { assert } from 'console';
import * as vscode from 'vscode';
import { JOB_LOG_URI_SCHEME } from '../constants';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { getProjectRepository } from '../gitlab/gitlab_project_repository';
import { fromJobLogUri } from './job_log_uri';
import { jobLogCache } from './job_log_cache';

export async function saveRawJobTrace(jobUri: vscode.Uri): Promise<void> {
  assert(jobUri.scheme === JOB_LOG_URI_SCHEME);
  const { repositoryRoot, projectId, job } = fromJobLogUri(jobUri);
  const projectInRepository = getProjectRepository().getProjectOrFail(repositoryRoot);
  const gitlabService = getGitLabService(projectInRepository);

  const saveUri = await vscode.window.showSaveDialog({
    title: 'Save raw job trace',
    defaultUri: vscode.Uri.file(`${job}.log`),
  });
  if (!saveUri) return;

  const text =
    jobLogCache.get(job)?.rawTrace ??
    (await gitlabService.getJobTrace(projectInRepository.project, projectId, job))?.rawTrace;
  assert(text);

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(saveUri, encoder.encode(text));
}
