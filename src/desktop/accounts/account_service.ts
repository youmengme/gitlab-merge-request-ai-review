import assert from 'assert';
import { isDeepStrictEqual } from 'util';
import { EventEmitter, ExtensionContext, Event } from 'vscode';
import { log } from '../../common/log';
import { hasPresentKey } from '../utils/has_present_key';
import { notNullOrUndefined } from '../../common/utils/not_null_or_undefined';
import { removeTrailingSlash } from '../utils/remove_trailing_slash';
import { uniq } from '../utils/uniq';
import {
  Account,
  makeAccountId,
  OAuthAccount,
  serializeAccountSafe,
  TokenAccount,
} from '../../common/platform/gitlab_account';
import { readSingleLineFromFile, setEnvVariableFromFile } from '../utils/env_var_helpers';
import { UserFriendlyError } from '../../common/errors/user_friendly_error';
import { Credentials } from './credentials';

interface TokenSecret {
  token: string;
}

interface OAuthSecret {
  token: string;
  refreshToken: string;
  expiresAtTimestampInSeconds: number;
}
type Secret = TokenSecret | OAuthSecret;

/** Secrets by Account ID (<accountId, Secret | undefined>) */
type SecretsForAccounts = Record<string, Secret | undefined>;

type AccountWithoutSecret =
  | Omit<TokenAccount, keyof TokenSecret>
  | Omit<OAuthAccount, keyof OAuthSecret>;

const getEnvironmentVariables = (): Credentials | undefined => {
  const { GITLAB_WORKFLOW_INSTANCE_URL, GITLAB_WORKFLOW_TOKEN } = process.env;
  if (!GITLAB_WORKFLOW_INSTANCE_URL || !GITLAB_WORKFLOW_TOKEN) return undefined;
  return {
    instanceUrl: removeTrailingSlash(GITLAB_WORKFLOW_INSTANCE_URL),
    token: GITLAB_WORKFLOW_TOKEN,
  };
};

const ACCOUNTS_KEY = 'glAccounts';
const SECRETS_KEY = 'gitlab-tokens';

const getEnvAccount = (): Account | undefined => {
  const credentials = getEnvironmentVariables();
  if (!credentials) return undefined;
  return {
    id: makeAccountId(credentials.instanceUrl, 'environment-variables'),
    username: 'environment_variable_credentials',
    ...credentials,
    type: 'token',
  };
};

const getSecrets = async (
  context: ExtensionContext,
): Promise<Record<string, Secret | undefined>> => {
  const stringTokens = await context.secrets.get(SECRETS_KEY);
  return stringTokens ? JSON.parse(stringTokens) : {};
};

const splitAccount = (
  account: Account,
): { accountWithoutSecret: AccountWithoutSecret; secret: Secret } => {
  if (account.type === 'token') {
    const { token, ...accountWithoutSecret } = account;
    return { accountWithoutSecret, secret: { token } };
  }
  if (account.type === 'oauth') {
    const { token, refreshToken, expiresAtTimestampInSeconds, ...accountWithoutSecret } = account;
    return { accountWithoutSecret, secret: { token, refreshToken, expiresAtTimestampInSeconds } };
  }
  throw new Error(`Unexpected account type for account ${JSON.stringify(account)}`);
};

const setEnvVariablesFromFile = async () => {
  const { GITLAB_WORKFLOW_TOKEN_FILE, GITLAB_WORKFLOW_TOKEN } = process.env;
  if (!GITLAB_WORKFLOW_TOKEN && GITLAB_WORKFLOW_TOKEN_FILE) {
    try {
      await setEnvVariableFromFile(
        'GITLAB_WORKFLOW_TOKEN',
        GITLAB_WORKFLOW_TOKEN_FILE,
        readSingleLineFromFile,
      );
    } catch (error) {
      log.error(error);
    }
  }
};

export class AccountService {
  context?: ExtensionContext;

  secrets: SecretsForAccounts = {};

  #onDidChangeEmitter = new EventEmitter<void>();

  async init(context: ExtensionContext): Promise<void> {
    this.context = context;

    await setEnvVariablesFromFile();

    try {
      this.secrets = await getSecrets(context);
    } catch (error) {
      throw new UserFriendlyError(
        `GitLab Workflow can't access the OS Keychain. See this [existing issue](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/580) for more information.`,
        error,
      );
    }
  }

  get onDidChange(): Event<void> {
    return this.#onDidChangeEmitter.event;
  }

  get #accountMap(): Record<string, AccountWithoutSecret | undefined> {
    assert(this.context);
    return this.context.globalState.get(ACCOUNTS_KEY, {});
  }

  getInstanceUrls(): string[] {
    return uniq(this.getAllAccounts().map(a => a.instanceUrl));
  }

  /**
   * This method returns account for given instance URL or undefined if there is no such account.
   * If there are multiple accounts for the instance we'll log warning and use the first one.
   * @deprecated This method is used only for compatibility with legacy single-account logic. Handle the possibility of multiple accounts for the same instance!
   * @param instanceUrl
   * @returns The first account for this instance URL
   */
  getOneAccountForInstance(instanceUrl: string): Account | undefined {
    const accounts = this.getAllAccounts().filter(a => a.instanceUrl === instanceUrl);
    if (accounts.length > 1)
      log.warn(
        `[AccountService] There are multiple accounts for ${instanceUrl}.` +
          `Extension will use the one for user ${accounts[0].username}`,
      );
    return accounts[0];
  }

  getAllAccounts(): Account[] {
    return [...this.#getRemovableAccountsWithTokens(), getEnvAccount()].filter(notNullOrUndefined);
  }

  async addAccount(account: Account) {
    assert(this.context);
    // worst-case scenario we replace one set of valid credentials with another
    // we can refresh the cache
    await this.reloadCache();
    const accountMap = this.#accountMap;

    // If the account already exists, remove it first to allow re-authentication
    if (accountMap[account.id]) {
      log.info(
        `[AccountService][auth] Account for instance ${account.instanceUrl} and user ${account.username} already exists. Overriding with new credentials.`,
      );
      await this.removeAccount(account.id);
    }
    const { secret, accountWithoutSecret } = splitAccount(account);
    await this.#storeSecret(account.id, secret);

    await this.context.globalState.update(ACCOUNTS_KEY, {
      ...this.#accountMap,
      [account.id]: accountWithoutSecret,
    });

    this.#onDidChangeEmitter.fire();
  }

  async #validateSecretIsUpToDate(accountId: string) {
    const { oldSecrets, newSecrets } = await this.reloadCache();
    assert.deepStrictEqual(
      oldSecrets[accountId],
      newSecrets[accountId],
      `Task cancelled because the GitLab token for account ${accountId} stored in your keychain has changed. ` +
        '(Another instance of VS Code or OS synchronizing keychains changed it.) Retry the task. ' +
        `Old: ${JSON.stringify(oldSecrets[accountId])}, ` +
        `New: ${JSON.stringify(newSecrets[accountId])}`,
    );
  }

  async #removeToken(accountId: string) {
    assert(this.context);
    await this.#validateSecretIsUpToDate(accountId);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.secrets[accountId];
    await this.context.secrets.store(SECRETS_KEY, JSON.stringify(this.secrets));
  }

  async #storeSecret(accountId: string, secret: Secret) {
    assert(this.context);
    await this.#validateSecretIsUpToDate(accountId);
    const secrets = { ...this.secrets, [accountId]: secret };
    await this.context.secrets.store(SECRETS_KEY, JSON.stringify(secrets));
    this.secrets = secrets;
  }

  getAccount(accountId: string): Account | undefined {
    const result = this.getAllAccounts().find(a => a.id === accountId);
    return result;
  }

  async updateAccountSecret(account: Account) {
    log.info(`[AccountService][auth] Updating account secret for ${serializeAccountSafe(account)}`);
    assert(this.context);

    const { secret } = splitAccount(account);
    await this.#storeSecret(account.id, secret);
    log.info(
      `[AccountService][auth] Successfully updated account secret for ${serializeAccountSafe(account)}`,
    );
    this.#onDidChangeEmitter.fire();
  }

  /** Loads the latest secrets from OS Keychain, useful when other VS Code Windows manipulates the secrets. */
  async reloadCache(): Promise<{ oldSecrets: SecretsForAccounts; newSecrets: SecretsForAccounts }> {
    assert(this.context);
    const oldSecrets = this.secrets;
    const newSecrets = await getSecrets(this.context);
    this.secrets = newSecrets;
    if (!isDeepStrictEqual(Object.keys(oldSecrets), Object.keys(newSecrets))) {
      log.info(
        `[AccountService][auth] Token cache mismatch detected between local memory and OS Keychain.\n` +
          `Cached account IDs: ${Object.keys(oldSecrets)}, ` +
          `OS Keychain account IDs: ${Object.keys(newSecrets)}`,
      );
      this.#onDidChangeEmitter.fire();
    }
    return { oldSecrets, newSecrets };
  }

  async removeAccount(accountId: string) {
    assert(this.context);
    const accountMap = this.#accountMap;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete accountMap[accountId];

    await this.context.globalState.update(ACCOUNTS_KEY, accountMap);
    await this.#removeToken(accountId);
    this.#onDidChangeEmitter.fire();
  }

  async getUpToDateRemovableAccounts(): Promise<AccountWithoutSecret[]> {
    await this.reloadCache();
    return this.#getRemovableAccounts();
  }

  #getRemovableAccounts(): AccountWithoutSecret[] {
    return Object.values(this.#accountMap).filter(notNullOrUndefined);
  }

  #getRemovableAccountsWithTokens(): Account[] {
    const accountsWithMaybeTokens = this.#getRemovableAccounts().map(a => ({
      ...a,
      token: undefined,
      ...this.secrets[a.id],
    }));
    accountsWithMaybeTokens
      .filter(a => !a.token)
      .forEach(a =>
        log.error(
          `[AccountService][auth] Account for instance ${a.instanceUrl} and user ${a.username} is missing a token in secret storage. Remove the account and add it again.`,
        ),
      );
    return accountsWithMaybeTokens.filter((a): a is Account => hasPresentKey('token')(a));
  }
}

export const accountService: AccountService = new AccountService();
