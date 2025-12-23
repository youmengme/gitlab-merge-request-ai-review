import * as vscode from 'vscode';
import { accountService } from '../../accounts/account_service';
import { GITLAB_URL } from '../../../../test/integration/test_infrastructure/constants';
import { createTokenAccount } from '../../test_utils/entities';
import { gitlabCredentialsProvider } from './gitlab_credentials_provider';

jest.mock('../../accounts/account_service');

describe('GitLab Credentials Provider', () => {
  beforeEach(() => {});

  it('can get credentials when there is single account for the instance', async () => {
    accountService.getAllAccounts = () => [createTokenAccount(GITLAB_URL)];
    expect(
      (await gitlabCredentialsProvider.getCredentials(vscode.Uri.parse(GITLAB_URL)))?.password,
    ).toBe('abc');
  });

  it('can get credentials when there are multiple accounts for the instance', async () => {
    accountService.getAllAccounts = () => [
      createTokenAccount(GITLAB_URL, 1, 'abc'),
      createTokenAccount(GITLAB_URL, 2, 'def'),
    ];

    // always select the second option
    jest
      .mocked(vscode.window.showQuickPick)
      .mockImplementation(async options => (await options)[1]);

    expect(
      (await gitlabCredentialsProvider.getCredentials(vscode.Uri.parse(GITLAB_URL)))?.password,
    ).toBe('def');
  });

  it('returns undefined for url without token', async () => {
    accountService.getAllAccounts = () => [createTokenAccount(GITLAB_URL)];
    expect(
      await gitlabCredentialsProvider.getCredentials(vscode.Uri.parse('https://invalid.com')),
    ).toBe(undefined);
  });
});
