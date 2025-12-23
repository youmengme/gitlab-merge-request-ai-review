import { mapKeys } from 'lodash';
import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import {
  extensionConfigurationService,
  ExtensionConfiguration,
} from '../utils/extension_configuration_service';
import {
  LocalFeatureFlagService,
  isEnabled,
  FeatureFlag,
  FEATURE_FLAGS_DEFAULT_VALUES,
  DefaultLocalFeatureFlagService,
} from './local_feature_flag_service';

jest.mock('../utils/extension_configuration');

const VSCODE_CONTEXT_DEFAULT_LOCAL_FLAGS = mapKeys(
  FEATURE_FLAGS_DEFAULT_VALUES,
  (_, name) => `gitlab.featureFlags.${name}`,
);

describe('LocalFeatureFlagService', () => {
  let featureFlagService: LocalFeatureFlagService;

  const mockExtensionConfiguration = (featureFlags = {}) => {
    jest.spyOn(extensionConfigurationService, 'getConfiguration').mockReturnValue(
      createFakePartial<ExtensionConfiguration>({
        debug: false,
        featureFlags,
        ignoreCertificateErrors: false,
        customQueries: [],
      }),
    );
  };
  const getVSCodeContext = () => {
    const actualCalls = jest.mocked(vscode.commands.executeCommand).mock.calls;
    const entries = actualCalls
      .filter(([command]) => command === 'setContext')
      .map(([, name, value]) => [name, value]);

    return Object.fromEntries(entries);
  };

  const triggerDidChangeConfiguration = (e: vscode.ConfigurationChangeEvent) => {
    const promises = jest
      .mocked(vscode.workspace.onDidChangeConfiguration)
      .mock.calls.map(([listener]) => listener(e));

    return Promise.all(promises);
  };

  beforeEach(() => {
    mockExtensionConfiguration();

    featureFlagService = new DefaultLocalFeatureFlagService();
  });

  describe('isEnabled', () => {
    it.each`
      configurationValue | defaultValue | enabled
      ${undefined}       | ${true}      | ${true}
      ${undefined}       | ${false}     | ${false}
      ${true}            | ${true}      | ${true}
      ${true}            | ${false}     | ${true}
      ${false}           | ${true}      | ${false}
      ${false}           | ${false}     | ${false}
    `(
      'returns $outcome when config = $configurationValue && default = $defaultValue',
      ({ configurationValue, defaultValue, enabled }) => {
        mockExtensionConfiguration({ [FeatureFlag.TestFlag]: configurationValue });
        FEATURE_FLAGS_DEFAULT_VALUES[FeatureFlag.TestFlag] = defaultValue;

        expect(isEnabled(FeatureFlag.TestFlag)).toBe(enabled);
      },
    );
  });

  describe('local flags', () => {
    beforeEach(() => {
      mockExtensionConfiguration({ [FeatureFlag.TestFlag]: true });
      jest.mocked(vscode.workspace.onDidChangeConfiguration).mockClear();
      jest.mocked(vscode.commands.executeCommand).mockClear();
      featureFlagService = new DefaultLocalFeatureFlagService();
    });

    it('sets context in the constructor', () => {
      expect(getVSCodeContext()).toEqual({
        ...VSCODE_CONTEXT_DEFAULT_LOCAL_FLAGS,
        'gitlab.featureFlags.testflag': true,
      });
    });

    it('isLocalEnabled returns correct value', () => {
      expect(featureFlagService.isEnabled(FeatureFlag.TestFlag)).toBe(true);
    });
  });

  describe('when a feature flag setting changes', () => {
    it('when affectsConfiguration is false, it does nothing', async () => {
      jest.mocked(vscode.commands.executeCommand).mockClear();

      await triggerDidChangeConfiguration({ affectsConfiguration: () => false });

      expect(getVSCodeContext()).toEqual({});
    });

    it('when affectsConfiguration is true, it resets the local feature flags', async () => {
      jest.mocked(vscode.commands.executeCommand).mockClear();
      const config = createFakePartial<ExtensionConfiguration>({
        featureFlags: VSCODE_CONTEXT_DEFAULT_LOCAL_FLAGS,
      });

      jest.spyOn(extensionConfigurationService, 'getConfiguration').mockReturnValue(config);

      await triggerDidChangeConfiguration({ affectsConfiguration: () => true });

      expect(extensionConfigurationService.getConfiguration().featureFlags).toEqual(
        VSCODE_CONTEXT_DEFAULT_LOCAL_FLAGS,
      );
    });
  });
});
