import { ExtensionContext } from 'vscode';
import { createOAuthAccount, createTokenAccount } from '../test_utils/entities';
import { SecretStorage } from '../../common/test_utils/secret_storage';
import { Account, OAuthAccount } from '../../common/platform/gitlab_account';
import { InMemoryMemento } from '../../../test/integration/test_infrastructure/in_memory_memento';
import * as envVariableUtils from '../utils/env_var_helpers';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { AccountService } from './account_service';

const ACCOUNTS_KEY = 'glAccounts';
const SECRETS_KEY = 'gitlab-tokens';

describe('AccountService', () => {
  let accountService: AccountService;
  let secrets: SecretStorage;
  let fakeContext: ExtensionContext;

  beforeEach(async () => {
    secrets = new SecretStorage();
    fakeContext = createFakePartial<ExtensionContext>({
      globalState: new InMemoryMemento(),
      secrets,
    });
    await fakeContext.globalState.update(ACCOUNTS_KEY, {});
    accountService = new AccountService();
    await accountService.init(fakeContext);
  });

  describe('when GITLAB_WORKFLOW_TOKEN is not set but GITLAB_WORKFLOW_TOKEN_FILE is set', () => {
    beforeEach(() => {
      delete process.env.GITLAB_WORKFLOW_TOKEN;
      process.env.GITLAB_WORKFLOW_TOKEN_FILE = 'filePath';
    });

    afterEach(() => {
      delete process.env.GITLAB_WORKFLOW_TOKEN_FILE;
    });

    describe('when we can succssefully read the file', () => {
      it('updates the GITLAB_WORKFLOW_TOKEN', async () => {
        jest.spyOn(envVariableUtils, 'readSingleLineFromFile').mockImplementation(
          () =>
            new Promise<string>(resolve => {
              resolve('token-in-file');
            }),
        );
        await accountService.init(fakeContext);
        expect(process.env.GITLAB_WORKFLOW_TOKEN).toBe('token-in-file');
      });
    });

    describe('when we cannot read the file', () => {
      it('does not update the GITLAB_WORKFLOW_TOKEN', async () => {
        jest.spyOn(envVariableUtils, 'readSingleLineFromFile').mockImplementation(
          () =>
            new Promise<string>((_resolve, reject) => {
              reject(new Error('an err'));
            }),
        );
        await accountService.init(fakeContext);
        expect(process.env.GITLAB_WORKFLOW_TOKEN).toBe(undefined);
      });
    });
  });

  it('adds account', async () => {
    const account = createTokenAccount();
    await accountService.addAccount(account);

    expect(accountService.getAllAccounts()).toHaveLength(1);
    expect(accountService.getAllAccounts()).toEqual([account]);
  });

  it('overrides credentials when re-authenticating with the same account', async () => {
    const account = createTokenAccount('https://gitlab.com', 1, 'abc');
    await accountService.addAccount(account);
    const updatedAccount = createTokenAccount('https://gitlab.com', 1, 'def');

    await accountService.addAccount(updatedAccount);

    expect(accountService.getAllAccounts()).toHaveLength(1);
    expect(accountService.getAllAccounts()).toEqual([updatedAccount]);
    expect(accountService.getAccount(account.id)?.token).toBe('def');
  });

  it('refreshes token storage before adding an account', async () => {
    const account = createTokenAccount();
    await accountService.addAccount(account);
    // this simulates a situation when a different extension removed account
    // but the account service cache would still have secrets stored in cache
    await fakeContext.globalState.update(ACCOUNTS_KEY, {});

    // if the token was identical, the cache integrity check wouldn't fail
    // and we wouldn't test that we refresh the cache beforehand
    const accountWithDifferentToken = { ...account, token: 'xxx-test' };

    await accountService.addAccount(accountWithDifferentToken);

    expect(accountService.getAllAccounts()).toHaveLength(1);
  });

  describe('when other VS Code window changes the secrets', () => {
    let account: Account;
    beforeEach(async () => {
      account = createTokenAccount('https://gitlab.com', 1, 'abc');
      await accountService.addAccount(account);
      // other VS Code window manipulated the secrets
      await secrets.store('gitlab-tokens', '{"https://gitlab.com|1": {"token": "xyz"}}');
    });

    it('fails to write a secret when some other process changed the secret but refreshes the secrets cache', async () => {
      await expect(
        accountService.updateAccountSecret(createTokenAccount('https://gitlab.com', 1, 'def')),
      ).rejects.toThrow(/GitLab token .* has changed/);

      expect(accountService.getAccount(account.id)?.token).toBe('xyz');
    });

    it('reloads the cache', async () => {
      await accountService.reloadCache();

      expect(accountService.getAccount(account.id)?.token).toBe('xyz');
    });
  });

  it('removes account', async () => {
    const account = createTokenAccount();

    await accountService.addAccount(account);

    expect(accountService.getAllAccounts()).toHaveLength(1);

    await accountService.removeAccount(account.id);

    expect(accountService.getAllAccounts()).toHaveLength(0);
    expect(await secrets.get(SECRETS_KEY)).toBe('{}');
  });

  it('offers account for removal even if it does not have a token', async () => {
    const account = createTokenAccount();

    await accountService.addAccount(account);

    await secrets.store(SECRETS_KEY, '{}');
    await accountService.init(fakeContext); // reload secrets from the store

    expect(accountService.getAllAccounts()).toHaveLength(0); // the account can't be used
    expect(await accountService.getUpToDateRemovableAccounts()).toHaveLength(1); // but it can be removed
  });

  describe('account from environment variable', () => {
    afterEach(() => {
      delete process.env.GITLAB_WORKFLOW_INSTANCE_URL;
      delete process.env.GITLAB_WORKFLOW_TOKEN;
    });

    it('adds account', () => {
      process.env.GITLAB_WORKFLOW_INSTANCE_URL = 'https://gitlab.com';
      process.env.GITLAB_WORKFLOW_TOKEN = 'abc';

      expect(accountService.getAllAccounts()).toHaveLength(1);

      expect(accountService.getAllAccounts()[0]).toEqual({
        id: 'https://gitlab.com|environment-variables',
        instanceUrl: 'https://gitlab.com',
        token: 'abc',
        username: 'environment_variable_credentials',
        type: 'token',
      });
    });

    it('sanitizes instance URL from env', () => {
      process.env.GITLAB_WORKFLOW_INSTANCE_URL = 'https://gitlab.com/';
      process.env.GITLAB_WORKFLOW_TOKEN = 'abc';

      expect(accountService.getAllAccounts()).toHaveLength(1);

      expect(accountService.getAllAccounts()[0]).toEqual({
        id: 'https://gitlab.com|environment-variables',
        instanceUrl: 'https://gitlab.com',
        token: 'abc',
        username: 'environment_variable_credentials',
        type: 'token',
      });
    });
  });

  it('can set and get one account', async () => {
    expect(accountService.getOneAccountForInstance('https://gitlab.com')).toBeUndefined();

    await accountService.addAccount(createTokenAccount('https://gitlab.com', 1, 'abc'));
    expect(accountService.getOneAccountForInstance('https://gitlab.com')?.token).toBe('abc');
  });

  it('can retrieve all instance URLs', async () => {
    await accountService.addAccount(createTokenAccount('https://gitlab.com', 1, 'abc'));
    await accountService.addAccount(createTokenAccount('https://dev.gitlab.com', 1, 'def'));
    expect((await accountService.getUpToDateRemovableAccounts()).map(a => a.instanceUrl)).toEqual([
      'https://gitlab.com',
      'https://dev.gitlab.com',
    ]);
  });

  it('can get account based on ID', async () => {
    const firstAccount = createTokenAccount('https://gitlab.com', 1, 'abc');
    const secondAccount = createTokenAccount('https://dev.gitlab.com', 1, 'def');
    await accountService.addAccount(firstAccount);
    await accountService.addAccount(secondAccount);

    const result = accountService.getAccount(firstAccount.id);

    expect(result).toEqual(firstAccount);
  });

  describe('updateAccountSecret', () => {
    it('can update Token Account', async () => {
      const firstAccount = createTokenAccount('https://gitlab.com', 1, 'abc');
      const updatedTokenAccount = { ...firstAccount, token: 'xyz' };
      await accountService.addAccount(firstAccount);

      await accountService.updateAccountSecret(updatedTokenAccount);

      const result = accountService.getAccount(firstAccount.id);

      expect(result).toEqual(updatedTokenAccount);
    });

    it('can update OAuth Account', async () => {
      const nowTimestamp = Math.floor(new Date().getTime() / 1000);
      const account = createOAuthAccount();
      const updatedOAuthAccount = {
        ...account,
        token: 'xyz',
        refreshToken: 'z12',
        expiresAtTimestampInSeconds: nowTimestamp + 30,
      };
      await accountService.addAccount(account);

      await accountService.updateAccountSecret(updatedOAuthAccount);

      const result = accountService.getAccount(account.id);

      expect(result).toEqual(updatedOAuthAccount);
    });

    it('triggers onChange', async () => {
      const firstAccount = createTokenAccount('https://gitlab.com', 1, 'abc');
      const updatedTokenAccount = { ...firstAccount, token: 'xyz' };
      await accountService.addAccount(firstAccount);
      const listener = jest.fn();
      accountService.onDidChange(listener);

      await accountService.updateAccountSecret(updatedTokenAccount);

      expect(listener).toHaveBeenCalled();
    });
  });
  describe('OAuth accounts', () => {
    let account: OAuthAccount;

    beforeEach(async () => {
      account = createOAuthAccount();
      await accountService.addAccount(account);
    });

    it('can store OAuth account', async () => {
      const result = accountService.getAccount(account.id);

      expect(result).toEqual(account);
    });

    it('does not store secrets in global state', async () => {
      expect(fakeContext.globalState.get(ACCOUNTS_KEY)).toEqual({
        [account.id]: {
          ...account,
          token: undefined,
          refreshToken: undefined,
          expiresAtTimestampInSeconds: undefined,
        },
      });
    });

    it('overrides OAuth account when re-authenticating', async () => {
      const nowTimestamp = Math.floor(new Date().getTime() / 1000);
      const updatedAccount = {
        ...account,
        token: 'new-token',
        refreshToken: 'new-refresh-token',
        expiresAtTimestampInSeconds: nowTimestamp + 7200,
      };

      await accountService.addAccount(updatedAccount);

      const result = accountService.getAccount(account.id);
      expect(result).toEqual(updatedAccount);
      expect(accountService.getAllAccounts()).toHaveLength(1);
    });
  });
});
