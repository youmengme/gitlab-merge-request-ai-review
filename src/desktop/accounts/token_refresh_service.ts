import * as vscode from 'vscode';
import { isNumber } from 'lodash';
import { ExponentialBackoffCircuitBreaker } from '@gitlab-org/gitlab-lsp';
import { OAuthAccount, serializeAccountSafe } from '../../common/platform/gitlab_account';
import { log } from '../../common/log';
import { TokenExchangeService } from '../gitlab/token_exchange_service';
import { AccountService } from './account_service';

export class TokenRefreshService implements vscode.Disposable {
  #accountService: AccountService;

  #tokenExchangeService: TokenExchangeService;

  #subscriptions: vscode.Disposable[] = [];

  #refreshTimeouts: vscode.Disposable[] = [];

  constructor(accountService: AccountService, tokenExchangeService: TokenExchangeService) {
    this.#accountService = accountService;
    this.#tokenExchangeService = tokenExchangeService;

    this.#subscriptions.push(this.#accountService.onDidChange(() => this.#handleAccountsChange()));

    this.#handleAccountsChange();
  }

  dispose(): void {
    this.#clearAllRefreshes();
    this.#subscriptions.forEach(d => d.dispose());
  }

  #clearAllRefreshes(): void {
    this.#refreshTimeouts.forEach(disposable => disposable.dispose());
    this.#refreshTimeouts = [];
  }

  #handleAccountsChange() {
    this.#clearAllRefreshes();

    const oauthAccounts = this.#accountService
      .getAllAccounts()
      .filter((account): account is OAuthAccount => account.type === 'oauth');

    oauthAccounts.map(account => this.#scheduleTokenRefresh(account));
  }

  #scheduleTokenRefresh(account: OAuthAccount) {
    if (!isNumber(account.expiresAtTimestampInSeconds)) {
      // some OAuth accounts don't have this property and they fail the whole extension startup
      // https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/1909
      // we don't know why, hopefully these logs will tell us what's stored inside the `expiresAtTimestampInSeconds` property
      log.warn(
        `[TokenRefreshService][auth] Unable to schedule OAuth token refresh for account ${serializeAccountSafe(account)}, the 'expiresAtTimestampInSeconds' property is not a number: ${account.expiresAtTimestampInSeconds}. Please remove the account and authenticate again.`,
      );
      return;
    }
    const msUntilExpiry = Math.max(account.expiresAtTimestampInSeconds * 1000 - Date.now(), 0);
    const circuitBreaker = new ExponentialBackoffCircuitBreaker();

    log.info(
      `[TokenRefreshService][auth] Scheduling token refresh for ${serializeAccountSafe(account)} in ${msUntilExpiry / 1000} seconds (expires at ${new Date(account.expiresAtTimestampInSeconds * 1000).toISOString()})`,
    );

    const timeout = setTimeout(() => this.#refreshToken(account, circuitBreaker), msUntilExpiry);
    this.#refreshTimeouts.push(
      new vscode.Disposable(() => {
        clearTimeout(timeout);
      }),
    );
  }

  async #refreshToken(account: OAuthAccount, circuitBreaker: ExponentialBackoffCircuitBreaker) {
    if (circuitBreaker.isOpen()) {
      log.info(
        `[TokenRefreshService][auth] Token refresh circuit breaker is open for account ${serializeAccountSafe(account)}. Will retry when circuit closes.`,
      );
      const disposable = circuitBreaker.onClose(async () => {
        disposable.dispose();
        await this.#refreshToken(account, circuitBreaker);
      });
      return;
    }

    try {
      log.info(
        `[TokenRefreshService][auth] Triggering scheduled token refresh for account ${serializeAccountSafe(account)}`,
      );
      await this.#tokenExchangeService.refreshIfNeeded(account.id);
    } catch (error) {
      circuitBreaker.error();
      log.error(
        `[TokenRefreshService][auth] Failed to refresh token for account ${account.id}:`,
        error,
      );
      // The next call will check circuit breaker state and handle appropriately
      await this.#refreshToken(account, circuitBreaker);
    }
  }
}
