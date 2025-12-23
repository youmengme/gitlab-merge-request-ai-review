import { PostRequest } from '../platform/web_ide';
import { GitLabPlatformManagerForCodeSuggestions } from './gitlab_platform_manager_for_code_suggestions';

export interface CompletionToken {
  access_token: string;
  /* expires in number of seconds since `created_at` */
  expires_in: number;
  /* unix timestamp of the datetime of token creation */
  created_at: number;
}

const tokenRequest: PostRequest<CompletionToken> = {
  type: 'rest',
  method: 'POST',
  path: '/code_suggestions/tokens',
};

export class CodeSuggestionsTokenManager {
  #manager: GitLabPlatformManagerForCodeSuggestions;

  #currentToken: CompletionToken | undefined;

  constructor(manager: GitLabPlatformManagerForCodeSuggestions) {
    this.#manager = manager;
  }

  async getToken(): Promise<CompletionToken | undefined> {
    if (this.#currentToken) {
      const unixTimestampNow = Math.floor(new Date().getTime() / 1000);
      if (unixTimestampNow < this.#currentToken.created_at + this.#currentToken.expires_in) {
        return this.#currentToken;
      }
    }

    const platform = await this.#manager.getGitLabPlatform();
    if (!platform) {
      return undefined;
    }

    const token = await platform.fetchFromApi(tokenRequest);
    this.#currentToken = token;

    return this.#currentToken;
  }
}
