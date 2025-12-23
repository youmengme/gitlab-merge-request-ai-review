import * as vscode from 'vscode';
import { Account } from '../../common/platform/gitlab_account';
import { accountService } from '../accounts/account_service';
import { RefreshingGitLabService } from '../gitlab/refreshing_gitlab_service';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { FetchError } from '../../common/errors/fetch_error';
import { account as patAccount } from '../../common/test_utils/entities';
import { createOAuthAccount } from '../test_utils/entities';
import { USER_COMMANDS } from '../command_names';
import { validateAccounts } from './validate_accounts';

jest.mock('../gitlab/refreshing_gitlab_service');
jest.mock('../../common/errors/handle_error');

describe('validateAccounts', () => {
  let mockedAccounts: Account[] = [];

  beforeEach(() => {
    jest.resetAllMocks();
    accountService.getAllAccounts = () => mockedAccounts;
    accountService.removeAccount = jest.fn();
  });

  it('shows message with authentication buttons when there are no accounts', async () => {
    mockedAccounts = [];
    await validateAccounts();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'No GitLab accounts are set up.',
      { title: 'Authenticate to GitLab', command: 'gl.authenticate' },
    );
  });

  it('executes a command from the no account message', async () => {
    mockedAccounts = [];
    jest
      .mocked(vscode.window.showInformationMessage as jest.Func)
      .mockResolvedValue({ title: 'Authenticate to GitLab.com', command: 'gl.authenticate' });
    await validateAccounts();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('gl.authenticate');
  });

  describe('with invalid account', () => {
    let error: FetchError;
    beforeEach(() => {
      jest.mocked(RefreshingGitLabService).mockReturnValue(
        createFakePartial<RefreshingGitLabService>({
          fetchFromApi: jest.fn().mockImplementation(async () => {
            throw error;
          }),
        }),
      );
    });
    describe('with generic error', () => {
      beforeEach(() => {
        error = new FetchError(createFakePartial<Response>({ status: 500 }), 'resource name');
      });

      it('Show error and offer removing the account', async () => {
        mockedAccounts = [patAccount];
        await validateAccounts();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
          expect.stringMatching(/Account validation .* failed.*/),
          'Delete Account',
          'Show Logs',
        );
      });

      it('Deletes account', async () => {
        mockedAccounts = [patAccount];
        jest
          .mocked(vscode.window.showErrorMessage)
          .mockResolvedValue('Delete Account' as unknown as vscode.MessageItem);
        await validateAccounts();
        expect(accountService.removeAccount).toHaveBeenCalledWith(patAccount.id);
      });
    });

    describe('with invalid token error', () => {
      beforeEach(() => {
        error = new FetchError(
          createFakePartial<Response>({ status: 401 }),
          'resource name',
          '{"error":"invalid_token"}',
        );
      });

      describe.each([
        { account: patAccount, name: 'PAT' },
        { account: createOAuthAccount(), name: 'OAuth' },
      ])('for $name account', ({ account }) => {
        beforeEach(() => {
          mockedAccounts = [account];
        });

        it('shows invalid token error and offers to delete or ignore account', async () => {
          await validateAccounts();
          expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringMatching('expired or been revoked'),
            'Re-authenticate',
            'Ignore Error',
          );
        });

        it('ignores account', async () => {
          mockedAccounts = [{ ...account, id: 'id-to-ignore' }];
          jest
            .mocked(vscode.window.showErrorMessage as jest.Func) // I wasn't able to make TS choose the correct overloaded signature
            .mockResolvedValue('Ignore Error');
          await validateAccounts();
          await validateAccounts();

          expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringMatching("has issues but it's ignored"),
          );
        });

        it('deletes account and runs Authenticate command', async () => {
          jest
            .mocked(vscode.window.showErrorMessage as jest.Func) // I wasn't able to make TS choose the correct overloaded signature
            .mockResolvedValue('Re-authenticate');
          await validateAccounts();

          expect(accountService.removeAccount).toHaveBeenCalledWith(mockedAccounts[0].id);
          expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            USER_COMMANDS.AUTHENTICATE,
            mockedAccounts[0].instanceUrl,
          );
        });
      });
    });
  });
});
