import { accountService } from '../../accounts/account_service';
import { API } from '../../api/git';
import { FakeGitExtension } from '../../test_utils/fake_git_extension';
import { createTokenAccount } from '../../test_utils/entities';
import { GitLabRemoteSourceRepository } from './gitlab_remote_source_repository';

jest.mock('../../accounts/account_service', () => ({
  accountService: {
    onDidChange: jest.fn(),
  },
}));

describe('GitLabRemoteSourceRepository', () => {
  let fakeExtension: FakeGitExtension;
  let tokenChangeListener: () => unknown;

  beforeEach(async () => {
    fakeExtension = new FakeGitExtension();
    jest.mocked(accountService.onDidChange).mockImplementation((listener, bindThis) => {
      tokenChangeListener = () => listener.call(bindThis);
      return {
        dispose: jest.fn(),
      };
    });
  });

  it('remote source provider created for new token', async () => {
    accountService.getAllAccounts = () => [createTokenAccount('https://test2.gitlab.com', 1)];
    // TODO: maybe introduce something like an initialize method instead of doing the work in constructor
    // eslint-disable-next-line no-new
    new GitLabRemoteSourceRepository(fakeExtension.gitApi as unknown as API);

    expect(fakeExtension.gitApi.remoteSourceProviders.length).toBe(1);

    accountService.getAllAccounts = () => [
      createTokenAccount('https://test2.gitlab.com', 1),
      createTokenAccount('https://test2.gitlab.com', 2),
      createTokenAccount('https://test3.gitlab.com'),
    ];

    tokenChangeListener();

    expect(fakeExtension.gitApi.remoteSourceProviders.length).toBe(3);
  });

  it('remote source providers disposed after token removal', async () => {
    accountService.getAllAccounts = () => [
      createTokenAccount('https://test2.gitlab.com'),
      createTokenAccount('https://test3.gitlab.com'),
    ];
    // TODO: maybe introduce something like an initialize method instead of doing the work in constructor
    // eslint-disable-next-line no-new
    new GitLabRemoteSourceRepository(fakeExtension.gitApi as unknown as API);

    expect(fakeExtension.gitApi.remoteSourceProviders.length).toBe(2);

    accountService.getAllAccounts = () => [createTokenAccount('https://test2.gitlab.com')];

    tokenChangeListener();

    expect(fakeExtension.gitApi.remoteSourceProviders.length).toBe(1);
  });
});
