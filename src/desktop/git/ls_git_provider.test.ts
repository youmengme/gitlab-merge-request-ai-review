import * as vscode from 'vscode';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { LSGitProviderDesktop } from './ls_git_provider';
import { gitExtensionWrapper } from './git_extension_wrapper';
import { GitRepository } from './new_git';

describe('LSGitProviderDesktop', () => {
  let provider: LSGitProviderDesktop;
  const mockRepository = {
    rawRepository: {
      rootUri: { fsPath: '/path/to/repo' } as vscode.Uri,
      diffWithHEAD: jest.fn(),
      diffWith: jest.fn(),
      diffBetween: jest.fn(),
    },
  };

  beforeEach(() => {
    provider = new LSGitProviderDesktop();
    jest
      .spyOn(gitExtensionWrapper, 'gitRepositories', 'get')
      .mockReturnValue([createFakePartial<GitRepository>(mockRepository)]);
  });

  describe('getDiffWithHead', () => {
    const uri = vscode.Uri.file('/path/to/repo');
    const expectedDiff = 'diff content';

    beforeEach(() => {
      mockRepository.rawRepository.diffWithHEAD.mockResolvedValue(expectedDiff);
    });

    it('returns diff from repository', async () => {
      const result = await provider.getDiffWithHead(uri);

      expect(result).toBe(expectedDiff);
      expect(mockRepository.rawRepository.diffWithHEAD).toHaveBeenCalledWith(uri.fsPath);
    });

    it('returns undefined when repository not found', async () => {
      jest.spyOn(gitExtensionWrapper, 'gitRepositories', 'get').mockReturnValue([]);

      const result = await provider.getDiffWithHead(uri);

      expect(result).toBeUndefined();
    });

    it('propagates errors from git', async () => {
      const error = new Error('Git error');
      mockRepository.rawRepository.diffWithHEAD.mockRejectedValue(error);

      await expect(provider.getDiffWithHead(uri)).rejects.toThrow(error);
    });
  });

  describe('getDiffWithBranch', () => {
    const uri = vscode.Uri.file('/path/to/repo');
    const branch = 'feature-branch';
    const expectedDiff = 'diff content';

    beforeEach(() => {
      mockRepository.rawRepository.diffWith.mockResolvedValue(expectedDiff);
    });

    it('returns diff from repository', async () => {
      const result = await provider.getDiffWithBranch(uri, branch);

      expect(result).toBe(expectedDiff);
      expect(mockRepository.rawRepository.diffWith).toHaveBeenCalledWith(branch, uri.fsPath);
    });

    it('returns undefined when repository not found', async () => {
      jest.spyOn(gitExtensionWrapper, 'gitRepositories', 'get').mockReturnValue([]);

      const result = await provider.getDiffWithBranch(uri, branch);

      expect(result).toBeUndefined();
    });

    it('propagates errors from git', async () => {
      const error = new Error('Git error');
      mockRepository.rawRepository.diffWith.mockRejectedValue(error);

      await expect(provider.getDiffWithBranch(uri, branch)).rejects.toThrow(error);
    });
  });
});
