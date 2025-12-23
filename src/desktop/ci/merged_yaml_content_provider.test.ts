import * as vscode from 'vscode';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { getProjectRepository, GitLabProjectRepository } from '../gitlab/gitlab_project_repository';
import { GitLabService, ValidationResponse } from '../gitlab/gitlab_service';
import { projectInRepository } from '../test_utils/entities';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { MergedYamlContentProvider } from './merged_yaml_content_provider';
import { toMergedYamlUri } from './merged_yaml_uri';

jest.mock('../gitlab/get_gitlab_service');
jest.mock('../gitlab/gitlab_project_repository');

describe('MergedYamlContentProvider', () => {
  const content = '# Initial Merged YAML content';
  const remoteContent = '# Updated Merged YAML content';
  const uri = toMergedYamlUri({
    path: '/.gitlab-ci.yml',
    repositoryRoot: '/',
    initial: content,
  });

  const gitlabService = createFakePartial<GitLabService>({
    async validateCIConfig(): Promise<ValidationResponse> {
      return { valid: true, errors: [], merged_yaml: remoteContent };
    },
  });

  beforeEach(() => {
    jest.mocked(getGitLabService).mockReturnValue(gitlabService);
    jest.mocked(getProjectRepository).mockReturnValue(
      createFakePartial<GitLabProjectRepository>({
        getProjectOrFail: jest.fn().mockReturnValue(projectInRepository),
      }),
    );
    jest
      .mocked(vscode.workspace.onDidCloseTextDocument)
      .mockImplementation(() => ({ dispose: jest.fn() }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('loads the initial content', async () => {
    const provider = new MergedYamlContentProvider();

    const cancel = new vscode.CancellationTokenSource();
    const result = await provider.provideTextDocumentContent(uri, cancel.token);
    expect(result).toBe(content);
  });

  it('contacts the GitLab service on changes', async () => {
    jest
      .mocked(vscode.workspace.onDidOpenTextDocument)
      .mockImplementation(cb => cb(createFakePartial<vscode.TextDocument>({ uri })));
    jest.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(() =>
      createFakePartial<vscode.FileSystemWatcher>({
        onDidChange(cb) {
          // Call the file change callback immediately.
          cb({} as vscode.Uri);
          return { dispose: jest.fn() };
        },
      }),
    );
    const provider = new MergedYamlContentProvider();

    const cancel = new vscode.CancellationTokenSource();
    const result = await provider.provideTextDocumentContent(uri, cancel.token);
    expect(result).toBe(remoteContent);
  });
});
