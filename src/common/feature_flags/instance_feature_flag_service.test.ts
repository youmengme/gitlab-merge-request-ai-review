import { mapValues } from 'lodash';
import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { GitLabPlatformForAccount, GitLabPlatformManager } from '../platform/gitlab_platform';
import { gitlabPlatformForAccount } from '../test_utils/entities';
import {
  createFakeFetchFromApi,
  FakeRequestHandler,
} from '../test_utils/create_fake_fetch_from_api';
import { versionRequest } from '../gitlab/check_version';
import {
  InstanceFeatureFlagService,
  getInstanceFeatureFlagsRequest,
} from './instance_feature_flag_service';
import {
  INSTANCE_FEATURE_FLAGS,
  InstanceFeatureFlag,
  InstanceFeatureFlagIntroduced,
  InstanceFeatureFlagRollout,
} from './constants';

jest.mock('../utils/extension_configuration');

const VSCODE_CONTEXT_DEFAULT_INSTANCE_FLAGS = Object.fromEntries(
  INSTANCE_FEATURE_FLAGS.map(name => [`gitlab.featureFlags.${name}`, false]),
);

describe('InstanceFeatureFlagService', () => {
  let platform: GitLabPlatformForAccount;
  let platformManager: GitLabPlatformManager;
  let featureFlagService: InstanceFeatureFlagService;

  const setupFetchHandlers = (...requestHandlers: FakeRequestHandler<unknown>[]) => {
    platform = {
      ...platform,
      fetchFromApi: createFakeFetchFromApi(...requestHandlers),
    };
  };

  const getVSCodeContext = () => {
    const actualCalls = jest.mocked(vscode.commands.executeCommand).mock.calls;
    const entries = actualCalls
      .filter(([command]) => command === 'setContext')
      .map(([, name, value]) => [name, value]);

    return Object.fromEntries(entries);
  };

  const triggerOnAccountChange = () => {
    const promises = jest
      .mocked(platformManager.onAccountChange)
      .mock.calls.map(([listener]) => listener());

    return Promise.all(promises);
  };

  beforeEach(() => {
    platform = gitlabPlatformForAccount;

    platformManager = createFakePartial<GitLabPlatformManager>({
      onAccountChange: jest.fn(),
      getForActiveAccount: jest.fn().mockImplementation(() => Promise.resolve(platform)),
    });

    featureFlagService = new InstanceFeatureFlagService(platformManager);
  });

  // PLEASE NOTE: We can only query 20 flags at a time so this list shouldn't grow past that.
  // https://gitlab.com/gitlab-org/gitlab/-/blob/933b5643feebe1feb471be2652d98497c17bc65b/app/graphql/resolvers/app_config/gitlab_instance_feature_flags_resolver.rb#L7
  it('should not have more than 20 instance flags', () => {
    expect(INSTANCE_FEATURE_FLAGS.length).toBeLessThanOrEqual(20);
  });

  it('should include introduced versions for all instance flags', () => {
    expect(Object.values(INSTANCE_FEATURE_FLAGS)).toEqual(
      Object.keys(InstanceFeatureFlagIntroduced),
    );
  });

  it('should include include feature flags for instance flags being rolled out across instance versions', () => {
    Object.keys(InstanceFeatureFlagRollout).forEach(flag =>
      expect(Object.values(INSTANCE_FEATURE_FLAGS)).toContain(flag),
    );
  });

  describe('with instance flags set', () => {
    beforeEach(() => {
      setupFetchHandlers(
        {
          request: getInstanceFeatureFlagsRequest(INSTANCE_FEATURE_FLAGS),
          response: {
            metadata: {
              featureFlags: INSTANCE_FEATURE_FLAGS.map(name => ({ name, enabled: true })),
            },
          },
        },
        {
          request: versionRequest,
          response: {
            version: '17.4.0',
          },
        },
      );
    });

    it('sets the instance-level feature flag state on init', async () => {
      jest.mocked(vscode.commands.executeCommand).mockClear();

      await featureFlagService.init();

      expect(getVSCodeContext()).toEqual({
        ...mapValues(VSCODE_CONTEXT_DEFAULT_INSTANCE_FLAGS, () => true),
      });
    });
  });

  describe('with instance flags response empty', () => {
    beforeEach(() => {
      setupFetchHandlers({
        request: getInstanceFeatureFlagsRequest(INSTANCE_FEATURE_FLAGS),
        response: {
          metadata: {
            featureFlags: [],
          },
        },
      });
    });

    it('sets the local and instance-level feature flag state', async () => {
      await featureFlagService.init();

      expect(getVSCodeContext()).toEqual({
        ...VSCODE_CONTEXT_DEFAULT_INSTANCE_FLAGS,
      });
    });
  });

  describe('with older instance', () => {
    beforeEach(() => {
      setupFetchHandlers({
        request: versionRequest,
        response: {
          version: '17.3.1',
        },
      });
    });

    it('disables flags by default', async () => {
      await featureFlagService.init();
      expect(getVSCodeContext()).toEqual({
        ...VSCODE_CONTEXT_DEFAULT_INSTANCE_FLAGS,
      });
    });
  });

  describe('with rolled out feature flags', () => {
    it('enabled rolled out feature flags by default', async () => {
      setupFetchHandlers(
        {
          request: getInstanceFeatureFlagsRequest(INSTANCE_FEATURE_FLAGS),
          response: {
            metadata: {
              // Completely rolled out feature flags are removed from the codebase in a future release.
              featureFlags: [],
            },
          },
        },
        {
          request: versionRequest,
          response: {
            version: '999.0.0',
          },
        },
      );
      jest.mocked(vscode.commands.executeCommand).mockClear();

      await featureFlagService.init();

      expect(getVSCodeContext()).toMatchObject({
        'gitlab.featureFlags.duo_agentic_chat': true,
        'gitlab.featureFlags.duo_workflow': true,
      });
    });

    it('disable feature flags when disabled in instance', async () => {
      setupFetchHandlers(
        {
          request: getInstanceFeatureFlagsRequest(INSTANCE_FEATURE_FLAGS),
          response: {
            metadata: {
              featureFlags: [
                { name: InstanceFeatureFlag.DuoAgenticChat, enabled: false },
                { name: InstanceFeatureFlag.DuoWorkflow, enabled: false },
              ],
            },
          },
        },
        {
          request: versionRequest,
          response: {
            version: '18.1.0',
          },
        },
      );
      jest.mocked(vscode.commands.executeCommand).mockClear();

      await featureFlagService.init();

      expect(getVSCodeContext()).toMatchObject({
        'gitlab.featureFlags.duo_agentic_chat': false,
        'gitlab.featureFlags.duo_workflow': false,
      });
    });

    it('disable feature flags that have not been introduced yet', async () => {
      setupFetchHandlers(
        {
          request: getInstanceFeatureFlagsRequest(INSTANCE_FEATURE_FLAGS),
          response: {
            metadata: {
              featureFlags: [{ name: InstanceFeatureFlag.DuoWorkflow, enabled: true }],
            },
          },
        },
        {
          request: versionRequest,
          response: {
            version: '17.5.0',
          },
        },
      );
      jest.mocked(vscode.commands.executeCommand).mockClear();

      await featureFlagService.init();

      expect(getVSCodeContext()).toMatchObject({
        'gitlab.featureFlags.duo_agentic_chat': false,
        'gitlab.featureFlags.duo_workflow': true,
      });
    });

    it('disable feature flags disabled by admin', async () => {
      setupFetchHandlers(
        {
          request: getInstanceFeatureFlagsRequest(INSTANCE_FEATURE_FLAGS),
          response: {
            metadata: {
              featureFlags: [
                { name: InstanceFeatureFlag.DuoAgenticChat, enabled: false },
                { name: InstanceFeatureFlag.DuoWorkflow, enabled: false },
              ],
            },
          },
        },
        {
          request: versionRequest,
          response: {
            version: '18.2.0',
          },
        },
      );
      jest.mocked(vscode.commands.executeCommand).mockClear();

      await featureFlagService.init();

      expect(getVSCodeContext()).toMatchObject({
        'gitlab.featureFlags.duo_agentic_chat': false,
        'gitlab.featureFlags.duo_workflow': false,
      });
    });
  });

  describe('when an account changes', () => {
    it('updates the instance-level feature flag context but not the local', async () => {
      await featureFlagService.init();
      jest.mocked(vscode.commands.executeCommand).mockClear();

      await triggerOnAccountChange();

      expect(getVSCodeContext()).toEqual(VSCODE_CONTEXT_DEFAULT_INSTANCE_FLAGS);
    });
  });
});
