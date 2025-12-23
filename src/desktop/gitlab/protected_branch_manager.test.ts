import * as vscode from 'vscode';
import { GitExtensionWrapper } from '../git/git_extension_wrapper';
import { createRemoteUrlPointers, GitRepositoryImpl } from '../git/new_git';
import { createFakeRepository } from '../test_utils/fake_git_extension';
import { projectInRepository } from '../test_utils/entities';
import { GitLabProjectRepository } from './gitlab_project_repository';
import { ProjectInRepository } from './new_project';
import { ProtectedBranchManager } from './protected_branch_manager';
import { ProtectedBranchProvider } from './protected_branch_provider';

const createPointers = (remotes: [string, string, string?][]) => {
  const repository = createFakeRepository({ remotes });
  const gitRepository = new GitRepositoryImpl(repository);
  return createRemoteUrlPointers(gitRepository);
};

describe('ProtectedBranchManager', () => {
  it('updates projects', () => {
    const [pointer] = createPointers([
      ['origin', 'git@gitlab.com:gitlab-org/gitlab-vscode-extension'],
    ]);
    const fakeGitWrapper: Partial<GitExtensionWrapper> = {
      gitRepositories: [pointer.repository],
      onRepositoryCountChanged: jest.fn(),
      registerBranchProtectionProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    };

    const emitter = new vscode.EventEmitter<readonly ProjectInRepository[]>();
    const fakeProjectRepository: Partial<GitLabProjectRepository> = {
      onProjectChange: emitter.event,
    };

    const manager = new ProtectedBranchManager(
      fakeGitWrapper as GitExtensionWrapper,
      fakeProjectRepository as GitLabProjectRepository,
    );

    emitter.fire([projectInRepository]);

    expect(fakeGitWrapper.registerBranchProtectionProvider).toHaveBeenCalledWith(
      expect.any(vscode.Uri),
      expect.any(ProtectedBranchProvider),
    );

    manager.dispose();
  });
});
