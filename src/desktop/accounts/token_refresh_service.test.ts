import { log } from '../../common/log';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { TokenExchangeService } from '../gitlab/token_exchange_service';
import { Account } from '../../common/platform/gitlab_account';
import { createOAuthAccount, createTokenAccount } from '../test_utils/entities';
import { TokenRefreshService } from './token_refresh_service';
import { AccountService } from './account_service';

jest.mock('../../common/log');
jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');
jest.spyOn(global, 'clearTimeout');

const nowInSeconds = () => Math.floor(Date.now() / 1000);

describe('TokenRefreshService', () => {
  let accountService: AccountService;
  let tokenExchangeService: TokenExchangeService;
  let allAccounts: Account[];
  let service: TokenRefreshService;
  let accountsChangeListener: () => void;

  beforeEach(() => {
    allAccounts = [];
    accountService = createFakePartial<AccountService>({
      getAllAccounts: () => allAccounts,
      onDidChange: l => {
        accountsChangeListener = l;
        return { dispose: () => {} };
      },
    });

    tokenExchangeService = createFakePartial<TokenExchangeService>({
      refreshIfNeeded: jest.fn(),
    });

    service = new TokenRefreshService(accountService, tokenExchangeService);
  });

  it('schedules and executes token refresh at the right time', async () => {
    const now = Date.now();
    jest.setSystemTime(now);

    // Create account that expires in 60 seconds
    const account = {
      ...createOAuthAccount(),
      expiresAtTimestampInSeconds: nowInSeconds() + 60,
    };
    allAccounts = [account];
    accountsChangeListener();

    // Advance time by 59 seconds
    jest.advanceTimersByTime(59_000);
    expect(tokenExchangeService.refreshIfNeeded).not.toHaveBeenCalled();

    // Advance time by 2 more seconds (total 61s)
    jest.advanceTimersByTime(2_000);
    expect(tokenExchangeService.refreshIfNeeded).toHaveBeenCalledWith(account.id);
    expect(tokenExchangeService.refreshIfNeeded).toHaveBeenCalledTimes(1);
  });

  it('does not schedule refresh for token accounts', () => {
    allAccounts = [createTokenAccount()];

    accountsChangeListener();

    expect(setTimeout).not.toHaveBeenCalled();
  });

  it('clears existing refreshes when accounts change', () => {
    const account1 = createOAuthAccount('https://gitlab.com', 1);
    allAccounts = [account1];
    accountsChangeListener();

    // Change accounts
    const account2 = createOAuthAccount('https://gitlab.com', 2);
    allAccounts = [account2];
    accountsChangeListener();

    expect(clearTimeout).toHaveBeenCalled();
  });

  it('handles multiple OAuth accounts', () => {
    const account1 = createOAuthAccount('https://gitlab.com', 1);
    const account2 = createOAuthAccount('https://gitlab.com', 2);
    allAccounts = [account1, account2];
    accountsChangeListener();

    expect(setTimeout).toHaveBeenCalledTimes(2);
  });

  it('cleans up timeouts on dispose', () => {
    const account = createOAuthAccount();
    allAccounts = [account];
    accountsChangeListener();

    service.dispose();

    expect(clearTimeout).toHaveBeenCalled();
  });

  it('logs error but does not crash when token refresh fails', async () => {
    const error = new Error('Refresh failed');
    jest.mocked(tokenExchangeService.refreshIfNeeded).mockRejectedValueOnce(error);

    const account = {
      ...createOAuthAccount(),
      expiresAtTimestampInSeconds: nowInSeconds(),
    };
    allAccounts = [account];
    accountsChangeListener();

    await jest.runAllTimersAsync();

    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/Failed to refresh token/), error);
  });

  it('uses exponential backoff when refresh fails repeatedly', async () => {
    const error = new Error('Refresh failed');
    jest.mocked(tokenExchangeService.refreshIfNeeded).mockRejectedValue(error);

    const account = {
      ...createOAuthAccount(),
      expiresAtTimestampInSeconds: nowInSeconds(),
    };
    allAccounts = [account];
    accountsChangeListener();

    // First attempt happens immediately
    await jest.advanceTimersByTimeAsync(0);
    expect(tokenExchangeService.refreshIfNeeded).toHaveBeenCalledTimes(1);

    // Circuit breaker should prevent immediate retry
    // Let's advance a small amount of time to process any pending promises
    await jest.advanceTimersByTimeAsync(100);
    expect(tokenExchangeService.refreshIfNeeded).toHaveBeenCalledTimes(1);

    // After initial backoff (1000ms), it should try again
    await jest.advanceTimersByTimeAsync(1000);
    expect(tokenExchangeService.refreshIfNeeded).toHaveBeenCalledTimes(2);

    // After doubled backoff (2000ms), it should try again
    await jest.advanceTimersByTimeAsync(2000);
    expect(tokenExchangeService.refreshIfNeeded).toHaveBeenCalledTimes(3);
  });
});
