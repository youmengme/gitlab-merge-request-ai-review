import vscode from 'vscode';
import { createOAuthAccount, createTokenAccount } from '../test_utils/entities';
import { accountService } from './account_service';
import { removeAccount } from './remove_account';

jest.mock('./account_service');

describe('token input', () => {
  describe('remove account', () => {
    beforeEach(() => {
      jest.mocked(vscode.window.showQuickPick).mockImplementation(async items => (await items)[0]);
    });

    it('removes account', async () => {
      const account = createTokenAccount();

      jest
        .mocked(accountService.getUpToDateRemovableAccounts)
        .mockResolvedValue([account, createOAuthAccount('http://example.com')]);

      await removeAccount();

      expect(accountService.removeAccount).toHaveBeenCalledWith(account.id);
    });
  });
});
