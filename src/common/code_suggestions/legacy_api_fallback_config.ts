import { coerce, gte, valid } from 'semver';
import { GetRequest } from '../platform/web_ide';
import { log } from '../log';
import { NEW_CODE_SUGGESTION_GITLAB_RELEASE } from './constants';
import { GitLabPlatformManagerForCodeSuggestions } from './gitlab_platform_manager_for_code_suggestions';

export class LegacyApiFallbackConfig {
  #manager;

  #isLegacyVersion;

  constructor(manager: GitLabPlatformManagerForCodeSuggestions) {
    this.#manager = manager;
    this.#isLegacyVersion = true;
  }

  shouldUseModelGateway() {
    return this.#isLegacyVersion;
  }

  flagLegacyVersion() {
    this.#isLegacyVersion = true;
  }

  async verifyGitLabVersion() {
    if (!valid(NEW_CODE_SUGGESTION_GITLAB_RELEASE)) {
      log.error(
        `Incorrect min GitLab version configured, falling back to legacy code suggestions API`,
      );
      this.flagLegacyVersion();
      return;
    }

    const platform = await this.#manager.getGitLabPlatform();

    if (!platform) {
      log.error(`Could not intialise API client, falling back to legacy code suggestions API`);
      this.flagLegacyVersion();
      return;
    }

    const versionReq: GetRequest<{ version: string }> = {
      type: 'rest',
      method: 'GET',
      path: '/version',
    };
    const { version } = await platform.fetchFromApi(versionReq);
    if (!version) {
      log.error(`Could not fetch version from API, falling back to legacy code suggestions API`);
      this.flagLegacyVersion();
      return;
    }

    const parsedVersion = coerce(version);
    if (!parsedVersion) {
      log.error(
        `Could not parse version from "${version}", falling back to legacy code suggestions API`,
      );
      this.flagLegacyVersion();
      return;
    }

    if (!gte(parsedVersion, NEW_CODE_SUGGESTION_GITLAB_RELEASE)) {
      log.warn(
        `GitLab version ${parsedVersion} is not new enough, falling back to legacy code suggestions API`,
      );
      this.flagLegacyVersion();
      return;
    }

    this.#isLegacyVersion = false;
  }
}
