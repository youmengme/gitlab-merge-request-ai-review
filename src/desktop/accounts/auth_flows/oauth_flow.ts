import crypto from 'crypto';
import assert from 'assert';
import vscode from 'vscode';
import { openUrl } from '../../commands/openers';
import { PromiseAdapter, promiseFromEvent } from '../../utils/promise_from_event';
import { GitLabUriHandler, gitlabUriHandler } from '../../gitlab_uri_handler';
import { OAUTH_REDIRECT_URI } from '../../constants';
import { generateSecret } from '../../../common/utils/generate_secret';
import { log } from '../../../common/log';
import { makeAccountId, OAuthAccount } from '../../../common/platform/gitlab_account';
import {
  AuthorizationCodeTokenExchangeParams,
  createExpiresTimestamp,
  GitLabService,
} from '../../gitlab/gitlab_service';
import { currentUserRequest } from '../../../common/gitlab/api/get_current_user';
import { getAuthenticationConfiguration } from '../../utils/extension_configuration';
import { Flow } from './flow';

const createOAuthAccountFromCode: (
  params: AuthorizationCodeTokenExchangeParams & { scopes: readonly string[] },
  clientId: string,
) => Promise<OAuthAccount> = async (params, clientId) => {
  const { code, codeVerifier } = params;
  const tokenResponse = await GitLabService.exchangeToken(
    {
      instanceUrl: params.instanceUrl,
      grantType: 'authorization_code',
      code,
      codeVerifier,
    },
    clientId,
  );
  const user = await new GitLabService({
    instanceUrl: params.instanceUrl,
    token: tokenResponse.access_token,
  }).fetchFromApi(currentUserRequest);
  const account: OAuthAccount = {
    instanceUrl: params.instanceUrl,
    token: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAtTimestampInSeconds: createExpiresTimestamp(tokenResponse),
    id: makeAccountId(params.instanceUrl, user.id),
    type: 'oauth',
    username: user.username,
    scopes: [...params.scopes],
  };
  return account;
};
const generateCodeChallengeFromVerifier = (v: string) => {
  const sha256 = (plain: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return crypto.createHash('sha256').update(data);
  };
  return sha256(v).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

interface OAuthUrlParams {
  instanceUrl: string;
  clientId: string;
  redirectUri: string;
  responseType?: string;
  state: string;
  scopes: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
}

const createAuthUrl = ({
  instanceUrl,
  clientId,
  redirectUri,
  responseType = 'code',
  state,
  scopes,
  codeChallenge,
  codeChallengeMethod = 'S256',
}: OAuthUrlParams) =>
  `${instanceUrl}/oauth/authorize?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    state,
    scope: scopes,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  })}`;

const createLoginUrl = (
  instanceUrl: string,
  scopesParam?: readonly string[],
): { url: string; state: string; codeVerifier: string; clientId: string } => {
  const state = generateSecret();
  const redirectUri = OAUTH_REDIRECT_URI;
  const codeVerifier = generateSecret();
  const codeChallenge = generateCodeChallengeFromVerifier(codeVerifier);
  const scopes = (scopesParam ?? ['api']).join(' ');
  const clientId = getAuthenticationConfiguration().oauthClientIds[instanceUrl] || '';
  return {
    url: createAuthUrl({ instanceUrl, clientId, redirectUri, state, scopes, codeChallenge }),
    state,
    codeVerifier,
    clientId,
  };
};

export class OAuthFlow implements Flow {
  title = 'OAuth';

  description = 'Authenticate using OAuth';

  #requestsInProgress: Record<string, string> = {};

  #uriHandler: GitLabUriHandler;

  constructor(uh = gitlabUriHandler) {
    this.#uriHandler = uh;
  }

  supportsGitLabInstance(url: string): boolean {
    const clientId = getAuthenticationConfiguration().oauthClientIds[url];
    return clientId !== undefined && clientId !== null && clientId !== '';
  }

  async authenticate(url: string) {
    if (this.supportsGitLabInstance(url)) {
      return this.#createAccount(url, ['api']);
    }

    return undefined;
  }

  async #createAccount(instanceUrl: string, scopes: readonly string[]): Promise<OAuthAccount> {
    const { url, state, codeVerifier, clientId } = createLoginUrl(instanceUrl, scopes);
    this.#requestsInProgress[state] = codeVerifier;
    const { promise: receivedRedirectUrl, cancel: cancelWaitingForRedirectUrl } = promiseFromEvent(
      this.#uriHandler.event,
      this.#exchangeCodeForToken(instanceUrl, state, scopes, clientId),
    );
    await openUrl(url);
    const account = await vscode.window.withProgress(
      {
        title: `Waiting for OAuth redirect from ${instanceUrl}.`,
        location: vscode.ProgressLocation.Notification,
      },
      () =>
        Promise.race([
          receivedRedirectUrl,
          new Promise<OAuthAccount>((_, reject) => {
            setTimeout(
              () => reject(new Error('Cancelling the GitLab OAuth login after 60s. Try again.')),
              60000,
            );
          }),
        ]).finally(() => {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete this.#requestsInProgress[state];
          cancelWaitingForRedirectUrl.fire();
        }),
    );

    return account;
  }

  #exchangeCodeForToken: (
    instanceUrl: string,
    state: string,
    scopes: readonly string[],
    clientId: string,
  ) => PromiseAdapter<vscode.Uri, OAuthAccount> =
    /* This callback is triggered on every vscode://gitlab-workflow URL.
    We will ignore invocations that are not related to the OAuth login with given `state`. */
    (instanceUrl, state, scopes, clientId) => async (uri, resolve, reject) => {
      if (uri.path !== '/authentication') return;
      const searchParams = new URLSearchParams(uri.query);
      const urlState = searchParams.get('state');
      if (!urlState) {
        reject(new Error(`Authentication URL ${uri} didn't contain 'state' query param.`));
        return;
      }
      if (state !== urlState) return;
      const codeVerifier = this.#requestsInProgress[state];
      assert(codeVerifier, 'Code verifier is missing.');
      const code = searchParams.get('code');
      if (!code) {
        reject(new Error(`Authentication URL ${uri} didn't contain 'code' query param.`));
        return;
      }
      try {
        const account = await createOAuthAccountFromCode(
          {
            instanceUrl,
            grantType: 'authorization_code',
            code,
            codeVerifier,
            scopes,
          },
          clientId,
        );
        resolve(account);
      } catch (e) {
        log.error('OAuth flow: Creating account from code failed: ', e);
        reject(e);
      }
    };
}
