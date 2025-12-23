import { currentUserRequest } from '../../common/gitlab/api/get_current_user';
import { FetchError } from '../../common/errors/fetch_error';
import { InsufficientScopesError } from '../errors/insufficient_scopes_error';
import { UserFriendlyError } from '../../common/errors/user_friendly_error';
import { personalAccessTokenDetailsRequest } from '../gitlab/api/get_personal_access_token_details';
import { GitLabService } from '../gitlab/gitlab_service';
import { validateGitLabVersion } from '../../common/gitlab/check_version';
import { log } from '../../common/log';
import { HelpError, README_SECTIONS } from '../errors/help_error';
import { Credentials } from './credentials';

export const getUserForCredentialsOrFail = async (credentials: Credentials): Promise<RestUser> => {
  const gitlabService = new GitLabService(credentials);
  try {
    let validationResult;
    try {
      validationResult = await validateGitLabVersion(gitlabService);
    } catch (e) {
      log.debug(`GitLab version check during adding token failed:`, e);
    }
    if (validationResult && !validationResult.valid) {
      throw new HelpError(
        `This extension requires GitLab version ${validationResult.minimum} or later, but you're using ${validationResult.current}.`,
        { section: README_SECTIONS.MINIMUM_VERSION },
      );
    }

    const tokenInfo = await gitlabService.fetchFromApi(personalAccessTokenDetailsRequest);

    const REQUIRED_SCOPES = ['api'];

    const firstMissingScope = REQUIRED_SCOPES.find(scope => !tokenInfo.scopes.includes(scope));
    if (firstMissingScope) {
      throw new InsufficientScopesError(tokenInfo.scopes, REQUIRED_SCOPES);
    }

    return await gitlabService.fetchFromApi(currentUserRequest);
  } catch (e) {
    if (e instanceof InsufficientScopesError || e instanceof HelpError) {
      // We already made this as nice one, rethrowing
      throw e;
    }

    const message =
      e instanceof FetchError && e.status === 401
        ? `API Unauthorized: Can't add GitLab account for ${credentials.instanceUrl}. Is your token valid?`
        : `Request failed: Can't add GitLab account for ${credentials.instanceUrl}. Check your instance URL and network connection.`;

    throw new UserFriendlyError(message, e);
  }
};
