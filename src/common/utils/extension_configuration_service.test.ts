import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { CONFIG_NAMESPACE } from '../constants';
import { ExtensionConfigurationService } from './extension_configuration_service';
import * as extensionConfiguration from './extension_configuration';

describe('ExtensionConfigurationService', () => {
  let configService: ExtensionConfigurationService;
  let configChangeHandler: (event: vscode.ConfigurationChangeEvent) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(vscode.workspace.onDidChangeConfiguration).mockImplementation(handler => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });

    // Mock getAgentPlatformConfiguration with default value
    jest.spyOn(extensionConfiguration, 'getAgentPlatformConfiguration').mockReturnValue({
      enabled: true,
      connectionType: 'websocket',
      defaultNamespace: 'gitlab-org',
      editFileDiffBehavior: 'foreground',
    });

    configService = new ExtensionConfigurationService();
  });

  describe('onChange', () => {
    it('should notify listener when configuration changes', () => {
      const listener = jest.fn();

      configService.onChange(listener);

      configChangeHandler({
        affectsConfiguration: (section: string) => section === CONFIG_NAMESPACE,
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('getConfiguration', () => {
    it('should return default configuration when no workspace config exists', () => {
      jest.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        createFakePartial<vscode.WorkspaceConfiguration>({
          get: jest.fn(),
          duo: undefined,
          featureFlags: undefined,
          debug: undefined,
          ignoreCertificateErrors: undefined,
          customQueries: undefined,
          pipelineGitRemoteName: undefined,
          trackingUrl: undefined,
        }),
      );

      const config = configService.getConfiguration();

      expect(config).toStrictEqual({
        duo: {
          enabledWithoutGitLabProject: undefined,
          workflow: {},
          agentPlatform: {
            enabled: true,
            defaultNamespace: undefined,
            connectionType: 'websocket',
            editFileDiffBehavior: 'foreground',
          },
        },
        pipelineGitRemoteName: undefined,
        featureFlags: {},
        debug: false,
        ignoreCertificateErrors: false,
        customQueries: [],
        trackingUrl: undefined,
      });
    });

    it('should return configured values when workspace config exists', () => {
      jest.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        createFakePartial<vscode.WorkspaceConfiguration>({
          get: jest.fn().mockReturnValue(undefined),
          duo: {
            enabledWithoutGitlabProject: true,
            workflow: {},
          },
          featureFlags: {
            'feature-flag-1': true,
            'feature-flag-2': false,
          },
          debug: true,
          ignoreCertificateErrors: true,
          customQueries: ['query-1', 'query-2'],
          pipelineGitRemoteName: 'origin',
          trackingUrl: 'https://example.com',
        }),
      );

      const config = configService.getConfiguration();

      expect(config).toStrictEqual({
        duo: {
          enabledWithoutGitLabProject: true,
          workflow: {},
          agentPlatform: {
            enabled: true,
            defaultNamespace: undefined,
            connectionType: 'websocket',
            editFileDiffBehavior: 'foreground',
          },
        },
        pipelineGitRemoteName: 'origin',
        featureFlags: {
          'feature-flag-1': true,
          'feature-flag-2': false,
        },
        debug: true,
        ignoreCertificateErrors: true,
        customQueries: ['query-1', 'query-2'],
        trackingUrl: 'https://example.com',
      });
    });
  });

  describe('getChangedConfigurationJSON', () => {
    beforeEach(() => {
      // Mock the extension
      jest.mocked(vscode.extensions.getExtension).mockReturnValue(
        createFakePartial<vscode.Extension<unknown>>({
          packageJSON: {
            contributes: {
              configuration: [
                {
                  properties: {
                    'gitlab.debug': { type: 'boolean', default: false },
                    'gitlab.featureFlags': { type: 'object', default: {} },
                    'gitlab.customQueries': { type: 'array', default: [] },
                  },
                },
              ],
            },
          },
        }),
      );
    });

    it('should return only changed configuration values', () => {
      const mockConfigValues: Record<string, { current: unknown; default: unknown }> = {
        'gitlab.debug': { current: true, default: false },
        'gitlab.featureFlags': { current: {}, default: {} },
        'gitlab.customQueries': { current: ['query1'], default: [] },
      };

      const mockConfig = createFakePartial<vscode.WorkspaceConfiguration>({
        get: jest.fn().mockImplementation(key => mockConfigValues[key]?.current),
        inspect: jest.fn().mockImplementation(key => ({
          defaultValue: mockConfigValues[key]?.default,
        })),
      });

      jest.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig);

      const result = configService.getChangedConfigurationJSON();

      expect(result).toEqual({
        'gitlab.debug': true,
        'gitlab.customQueries': ['query1'],
      });
    });

    it('should return empty object when no configuration values have changed', () => {
      const mockConfig = createFakePartial<vscode.WorkspaceConfiguration>({
        get: jest.fn().mockImplementation(key => {
          if (key === 'gitlab.debug') return false; // Same as default
          if (key === 'gitlab.featureFlags') return {}; // Same as default
          if (key === 'gitlab.customQueries') return []; // Same as default
          return undefined;
        }),
        inspect: jest.fn().mockImplementation(key => {
          if (key === 'gitlab.debug') {
            return { defaultValue: false };
          }
          if (key === 'gitlab.featureFlags') {
            return { defaultValue: {} };
          }
          if (key === 'gitlab.customQueries') {
            return { defaultValue: [] };
          }
          return undefined;
        }),
      });

      jest.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig);

      const result = configService.getChangedConfigurationJSON();

      expect(result).toEqual({});
    });

    it('should handle missing extension gracefully', () => {
      jest.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

      const result = configService.getChangedConfigurationJSON();

      expect(result).toEqual({});
    });
  });
});
