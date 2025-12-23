import { promises as fs } from 'fs';
import * as vscode from 'vscode';
import {
  patchSnippet,
  testSnippet1,
  testSnippet2,
} from '../../../test/integration/fixtures/graphql/snippets';
import { GitLabService } from '../gitlab/gitlab_service';
import { getLastCommitSha } from '../git/get_last_commit_sha';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { ProjectInRepository } from '../gitlab/new_project';
import { project } from '../../common/test_utils/entities';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { applySnippetPatch, NO_PATCH_SNIPPETS_MESSAGE } from './apply_snippet_patch';

jest.mock('../git/get_last_commit_sha');
jest.mock('../gitlab/get_gitlab_service');

const DIFF_OUTPUT = 'diff --git a/.gitlab-ci.yml b/.gitlab-ci.yml';

describe('apply snippet patch', () => {
  let gitlabService: Partial<GitLabService>;

  const pointer = { repository: { rawRepository: { apply: jest.fn() } } };

  const getAppliedPatchContent = async () => {
    const [[patchFile]] = jest.mocked(pointer.repository.rawRepository.apply).mock.calls;
    const patchContent = await fs.readFile(patchFile);
    return patchContent.toString();
  };

  beforeEach(() => {
    gitlabService = {};
    jest.mocked(getLastCommitSha).mockReturnValue('abcd1234567');
    jest.mocked(getGitLabService).mockReturnValue(createFakePartial<GitLabService>(gitlabService));

    jest
      .mocked(vscode.window.withProgress)
      .mockImplementation((_, task) => task({ report: jest.fn() }, {} as vscode.CancellationToken));
    jest
      .mocked(vscode.window.showQuickPick)
      .mockImplementation(async options => (await options)[0]);
    fs.unlink = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('calls git apply with the selected snippet patch', async () => {
    gitlabService.getSnippets = async () => [patchSnippet];
    gitlabService.getSnippetContent = async () => DIFF_OUTPUT;

    await applySnippetPatch({ pointer, project } as unknown as ProjectInRepository);

    expect(pointer.repository.rawRepository.apply).toHaveBeenCalled();
    expect(await getAppliedPatchContent()).toBe(DIFF_OUTPUT);
    expect(fs.unlink).toHaveBeenCalled();
  });

  it('shows information message when it cannot find any snippets', async () => {
    gitlabService.getSnippets = async () => [];

    await applySnippetPatch({ pointer, project } as unknown as ProjectInRepository);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(NO_PATCH_SNIPPETS_MESSAGE);
  });

  it('shows information message when returned snippets are not patch snippets', async () => {
    gitlabService.getSnippets = async () => [testSnippet1, testSnippet2];

    await applySnippetPatch({ pointer, project } as unknown as ProjectInRepository);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(NO_PATCH_SNIPPETS_MESSAGE);
  });
});
