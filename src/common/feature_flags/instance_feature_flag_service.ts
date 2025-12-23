import * as vscode from 'vscode';
import { gql } from 'graphql-request';
import { log } from '../log';
import { GraphQLRequest } from '../platform/web_ide';
import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { versionRequest } from '../gitlab/check_version';
import { ifVersionGte } from '../utils/if_version_gte';
import {
  INSTANCE_FEATURE_FLAGS,
  InstanceFeatureFlag,
  InstanceFeatureFlagIntroduced,
  InstanceFeatureFlagRollout,
} from './constants';
import { setFeatureFlagContext } from './utils';

export { InstanceFeatureFlag } from './constants';

const queryGetInstanceFlags = gql`
  query featureFlagsEnabled($names: [String!]!) {
    metadata {
      featureFlags(names: $names) {
        enabled
        name
      }
    }
  }
`;

export type InstanceFeatureFlagsResponseType = {
  metadata?: {
    featureFlags: { enabled: boolean; name: string }[];
  };
};

export const getInstanceFeatureFlagsRequest = (
  featureNames: InstanceFeatureFlag[],
): GraphQLRequest<InstanceFeatureFlagsResponseType> => {
  return {
    type: 'graphql',
    query: queryGetInstanceFlags,
    variables: {
      names: featureNames,
    },
  };
};

export class InstanceFeatureFlagService implements vscode.Disposable {
  readonly #manager: GitLabPlatformManager;

  readonly #disposables: vscode.Disposable[] = [];

  constructor(manager: GitLabPlatformManager) {
    this.#manager = manager;
    this.#disposables.push(
      this.#manager.onAccountChange(async () => {
        await this.#updateInstanceFeatureFlags();
      }),
    );
  }

  async init() {
    await this.#updateInstanceFeatureFlags();
  }

  async #updateInstanceFeatureFlags() {
    const values = await this.#fetchInstanceFeatureFlags(INSTANCE_FEATURE_FLAGS);

    return Promise.all(
      INSTANCE_FEATURE_FLAGS.map(flag => {
        const enabled = Boolean(values[flag]);

        return setFeatureFlagContext(flag, enabled);
      }),
    );
  }

  async #fetchInstanceFeatureFlags(flags: InstanceFeatureFlag[]): Promise<Record<string, boolean>> {
    const platform = await this.#manager.getForActiveAccount(false);

    if (!platform) {
      return {};
    }

    try {
      const { version } = await platform.fetchFromApi(versionRequest);
      return await ifVersionGte(
        version,
        '17.4.0',
        async () => {
          const response = await platform.fetchFromApi(getInstanceFeatureFlagsRequest(flags));

          if (!response.metadata) {
            return {};
          }

          return Object.fromEntries(
            INSTANCE_FEATURE_FLAGS.map(flag => {
              // If the response contained the specified feature flag use the configured value.
              const instanceFlag = response.metadata?.featureFlags.find(
                ({ name }) => name === flag,
              );
              if (instanceFlag?.enabled !== undefined) {
                return [flag, instanceFlag.enabled];
              }

              // Otherwise the feature flag either:
              // 1. Is not defined for this instance yet.
              // 2. Was removed from the codebase (after being enabled by default for a period).
              return ifVersionGte(
                version,
                InstanceFeatureFlagIntroduced[flag],
                () => {
                  const defaultEnabled = InstanceFeatureFlagRollout[flag];
                  return [
                    flag,
                    defaultEnabled &&
                      ifVersionGte(
                        version,
                        defaultEnabled,
                        () => true,
                        () => false,
                      ),
                  ];
                },
                () => [flag, false],
              );
            }),
          );
        },
        async () => ({}),
      );
    } catch (e) {
      log.error(e);

      return {};
    }
  }

  dispose(): void {
    this.#disposables.forEach(ch => ch.dispose());
  }
}
