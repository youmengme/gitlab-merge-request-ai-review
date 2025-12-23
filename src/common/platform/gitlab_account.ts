import { friendlyTokenHashOnlyForLogging } from '@gitlab-org/gitlab-lsp';

export interface Credentials {
  instanceUrl: string;
  token: string;
}

interface AccountBase extends Credentials {
  username: string;
  id: string;
}
export interface TokenAccount extends AccountBase {
  type: 'token';
}

export interface OAuthAccount extends AccountBase {
  type: 'oauth';
  scopes: string[];
  refreshToken: string;
  expiresAtTimestampInSeconds: number;
}

export type Account = TokenAccount | OAuthAccount;

export const serializeAccountSafe = (account: { id: string; token: string }) =>
  `(${account.id} - ${friendlyTokenHashOnlyForLogging(account.token)})`;

export const makeAccountId = (instanceUrl: string, userId: string | number) =>
  `${instanceUrl}|${userId}`;
