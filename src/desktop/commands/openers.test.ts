import path from 'path';
import * as vscode from 'vscode';
import { GitRepository } from '../git/new_git';
import { ProjectInRepository } from '../gitlab/new_project';

import * as testEntities from '../test_utils/entities';
import { createFakeRepository } from '../test_utils/fake_git_extension';
import { Repository } from '../api/git';
import { WarningError } from '../errors/warning_error';
import { copyLinkToActiveFile } from './openers';

const TEST_HASH = 'abcdefg';

describe('openers', () => {
  let rawRepository: Repository;
  let activeEditor: vscode.TextEditor;
  let pir: ProjectInRepository;

  beforeEach(() => {
    const repoRootPath = path.join('path', 'to', 'repo');
    rawRepository = createFakeRepository();
    pir = {
      ...testEntities.projectInRepository,
      pointer: {
        ...testEntities.projectInRepository.pointer,
        repository: {
          rootFsPath: repoRootPath,
          rawRepository,
        } as GitRepository,
      },
    };
    activeEditor = {
      document: { uri: vscode.Uri.file(path.join(repoRootPath, 'file')) },
      selection: {
        start: { line: 1 },
        end: { line: 2 },
      },
    } as unknown as vscode.TextEditor;
  });

  it('copyLinkToActiveFile creates permalink when active file is versioned', async () => {
    rawRepository.log = async () => [{ hash: TEST_HASH, message: '', parents: [] }];

    await copyLinkToActiveFile({ projectInRepository: pir, activeEditor });

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
      `https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/${TEST_HASH}/file#L2-3`,
    );
  });

  it('copyLinkToActiveFile shows error when active file is not versioned', async () => {
    rawRepository.log = async () => [];

    const copyResult = copyLinkToActiveFile({ projectInRepository: pir, activeEditor });

    await expect(copyResult).rejects.toThrow(WarningError);
    await expect(copyResult).rejects.toThrow(/No link exists for the current file/);

    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('copyLInkToActiveFile throws error when the file is not in the project repository', async () => {
    activeEditor = {
      document: { uri: vscode.Uri.file('Untitled-1') },
    } as unknown as vscode.TextEditor;

    const copyResult = copyLinkToActiveFile({ projectInRepository: pir, activeEditor });

    await expect(copyResult).rejects.toThrow(WarningError);
    await expect(copyResult).rejects.toThrow(/current file is not in the project repository/);
  });
});
