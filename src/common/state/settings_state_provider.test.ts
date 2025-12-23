import {
  ExtensionConfiguration,
  ExtensionConfigurationService,
} from '../utils/extension_configuration_service';
import {
  DuoChatConfiguration,
  DuoCodeSuggestionsConfiguration,
  getDuoChatConfiguration,
  getDuoCodeSuggestionsConfiguration,
  getHttpAgentConfiguration,
  getSecurityScannerConfiguration,
  httpAgentConfiguration,
  SecurityScannerConfiguration,
} from '../utils/extension_configuration';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { SettingsStateProvider } from './settings_state_provider';

jest.mock('../utils/extension_configuration', () => ({
  getDuoCodeSuggestionsConfiguration: jest.fn(),
  getDuoChatConfiguration: jest.fn(),
  getHttpAgentConfiguration: jest.fn(),
  getSecurityScannerConfiguration: jest.fn(),
}));

describe('SettingsStateProvider', () => {
  const mockConfigs = {
    extension: createFakePartial<ExtensionConfiguration>({
      duo: {
        enabledWithoutGitLabProject: false,
        workflow: {},
      },
    }),
    duo: createFakePartial<DuoCodeSuggestionsConfiguration>({
      enabled: true,
      additionalLanguages: [],
      enabledSupportedLanguages: {},
      openTabsContext: true,
    }),
    duoChat: createFakePartial<DuoChatConfiguration>({
      enabled: true,
    }),
    http: createFakePartial<httpAgentConfiguration>({
      ca: 'ca',
      cert: 'cert',
      certKey: 'certKey',
    }),
    security: createFakePartial<SecurityScannerConfiguration>({
      enabled: true,
      scanFileOnSave: true,
    }),
  };

  const expectedState = {
    extensionConfiguration: mockConfigs.extension,
    duoCodeSuggestionsConfiguration: mockConfigs.duo,
    duoChatConfiguration: mockConfigs.duoChat,
    httpProxyConfiguration: mockConfigs.http,
    securityScannerConfiguration: mockConfigs.security,
  };

  const configService = createFakePartial<ExtensionConfigurationService>({
    getConfiguration: jest.fn().mockReturnValue(mockConfigs.extension),
    onChange: jest.fn(),
  });
  let settingsStateProvider: SettingsStateProvider;

  beforeAll(() => {
    jest.mocked(getDuoCodeSuggestionsConfiguration).mockReturnValue(mockConfigs.duo);
    jest.mocked(getDuoChatConfiguration).mockReturnValue(mockConfigs.duoChat);
    jest.mocked(getHttpAgentConfiguration).mockReturnValue(mockConfigs.http);
    jest.mocked(getSecurityScannerConfiguration).mockReturnValue(mockConfigs.security);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    settingsStateProvider = new SettingsStateProvider(configService);
  });

  it('should initialize with correct state and setup listeners', () => {
    expect(settingsStateProvider.state).toEqual(expectedState);
    expect(configService.onChange).toHaveBeenCalled();
  });

  it('should return current state through state getter', () => {
    expect(settingsStateProvider.state).toEqual(expectedState);
  });

  it('should emit event when configuration changes', () => {
    const listener = jest.fn();
    settingsStateProvider.onChange(listener);
    const configChangeCallback = jest.mocked(configService.onChange).mock.calls[0][0];

    configChangeCallback(mockConfigs.extension);
    expect(listener).toHaveBeenCalledWith(settingsStateProvider.state);
  });
});
