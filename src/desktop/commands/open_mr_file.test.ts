import * as fs from 'fs';
import * as vscode from 'vscode';
import { VS_COMMANDS } from '../../common/command_names';
import { toReviewUri } from '../review/review_uri';
import { mrVersion, projectInRepository, reviewUriParams } from '../test_utils/entities';
import { CachedMr, mrCache } from '../gitlab/mr_cache';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { getProjectRepository, GitLabProjectRepository } from '../gitlab/gitlab_project_repository';
import { openMrFile } from './open_mr_file';

jest.mock('../gitlab/mr_cache');
jest.mock('../gitlab/gitlab_project_repository');

describe('openMrFile', () => {
  let accessSpy;

  beforeEach(() => {
    jest.mocked(getProjectRepository).mockReturnValue(
      createFakePartial<GitLabProjectRepository>({
        getProjectOrFail: jest.fn().mockReturnValue(projectInRepository),
      }),
    );
    jest.mocked(mrCache.getMr).mockReturnValue(createFakePartial<CachedMr>({ mrVersion }));
    accessSpy = jest.spyOn(fs.promises, 'access');

    jest.mocked(accessSpy).mockResolvedValue(undefined);
  });

  it('calls VS Code open with the correct diff file', async () => {
    await openMrFile(toReviewUri({ ...reviewUriParams, path: 'new_file.js' }));
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      VS_COMMANDS.OPEN,
      vscode.Uri.file('/new_file.js'),
    );
  });

  it("calls shows information message when the file doesn't exist", async () => {
    jest.mocked(fs.promises.access).mockRejectedValue(new Error());
    await openMrFile(toReviewUri({ ...reviewUriParams, path: 'new_file.js' }));
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
  });

  it("throws assertion error if the diff can't be found", async () => {
    await expect(
      openMrFile(toReviewUri({ ...reviewUriParams, path: 'file_that_is_not_in_mr_diff.c' })),
    ).rejects.toThrowError(/Extension did not find the file/);
  });
});
