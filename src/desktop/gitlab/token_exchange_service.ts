import assert from 'assert';
import { Account, OAuthAccount, serializeAccountSafe } from '../../common/platform/gitlab_account';
import { accountService, AccountService } from '../accounts/account_service';
import { log } from '../../common/log';
import { createExpiresTimestamp, GitLabService } from './gitlab_service';

/**
  We'll refresh the token 40s before it expires. On two hours it won't make a difference and
  I'd rather not rely on the local and server clocks being perfectly in sync. Otherwise we would
  risk making unauthorized requests.

  Originally we chose 10s, but 40s means that the sidebar refreshing (every 30s) will effectively
  ensure that we never have outdated token. This is important for the Language Server.
  The LS makes requests separately and it doesn't trigger the refreshing mechanism.

  Note: change this value to 7170 to simulate token expiration every 30s
*/
const SMALL_GRACE_DURATION_JUST_TO_BE_SURE = 40;

const needsRefresh = (account: OAuthAccount) => {
  const currentUnixTimestampInSeconds = Math.floor(new Date().getTime() / 1000);
  return (
    account.expiresAtTimestampInSeconds - SMALL_GRACE_DURATION_JUST_TO_BE_SURE <=
    currentUnixTimestampInSeconds
  );
};

export class TokenExchangeService {
  #accountService: AccountService;

  #refreshesInProgress: Record<string, Promise<Account> | undefined> = {};

  constructor(as = accountService) {
    this.#accountService = as;
  }

  async refreshIfNeeded(accountId: string): Promise<Account> {
    // before we start refreshing token, let's check if some other VS Code instance already has refreshed it
    await this.#accountService.reloadCache();
    const latestAccount = this.#accountService.getAccount(accountId);
    // this would happen if another VS Code Window deleted the account
    assert(latestAccount, `Account with id ${accountId} doesn't exist.`);
    if (latestAccount.type === 'token') return latestAccount;
    if (!needsRefresh(latestAccount)) {
      return latestAccount;
    }
    const refreshInProgress = this.#refreshesInProgress[accountId];
    if (refreshInProgress) {
      log.info(
        `[auth] Token refresh already in progress for account ${accountId}, reusing existing promise`,
      );
      return refreshInProgress;
    }
    log.info(`[auth]Refreshing expired token for account ${serializeAccountSafe(latestAccount)}`);
    const refresh = this.#refreshToken(latestAccount).finally(() => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.#refreshesInProgress[accountId];
    });
    this.#refreshesInProgress[accountId] = refresh;
    return refresh;
  }

  async #refreshToken(account: OAuthAccount): Promise<OAuthAccount> {
    const { instanceUrl, refreshToken } = account;
    log.info(`[auth] Exchanging refresh token for account ${serializeAccountSafe(account)})`);
    const { getAuthenticationConfiguration } = await import('../utils/extension_configuration');
    const clientId = getAuthenticationConfiguration().oauthClientIds[instanceUrl];
    assert(
      clientId && clientId !== '',
      `No OAuth client ID configured for instance ${instanceUrl}. Please configure the 'gitlab.authentication.oauthClientIds' setting in VS Code for this GitLab instance to enable token refresh.`,
    );
    const response = await GitLabService.exchangeToken(
      {
        grantType: 'refresh_token',
        instanceUrl,
        refreshToken,
      },
      clientId,
    );
    const refreshedAccount: OAuthAccount = {
      ...account,
      token: response.access_token,
      refreshToken: response.refresh_token,
      expiresAtTimestampInSeconds: createExpiresTimestamp(response),
    };
    log.info(
      `[auth] Successfully refreshed token for account ${serializeAccountSafe(refreshedAccount)})`,
    );
    await this.#accountService.updateAccountSecret(refreshedAccount);
    log.info(`[auth] Saved refreshed token for account ${serializeAccountSafe(refreshedAccount)}`);
    return refreshedAccount;
  }
}

export const tokenExchangeService = new TokenExchangeService();
