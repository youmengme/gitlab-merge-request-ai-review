import { FeatureFlag } from '../feature_flags/constants';
import { SettingsDetails } from '../state/settings_state_provider';
import {
  DuoChatConfiguration,
  DuoCodeSuggestionsConfiguration,
  httpAgentConfiguration,
  SecurityScannerConfiguration,
} from '../utils/extension_configuration';
import { ExtensionConfiguration } from '../utils/extension_configuration_service';
import { createFakePartial } from './create_fake_partial';

export const createMockSettingsDetails = (): SettingsDetails => ({
  extensionConfiguration: createFakePartial<ExtensionConfiguration>({
    duo: {
      enabledWithoutGitLabProject: false,
      workflow: {},
    },
    featureFlags: createFakePartial<Record<FeatureFlag, boolean>>({
      languageServer: true,
    }),
    debug: false,
    ignoreCertificateErrors: false,
    pipelineGitRemoteName: 'origin',
  }),
  duoCodeSuggestionsConfiguration: createFakePartial<DuoCodeSuggestionsConfiguration>({
    enabledSupportedLanguages: {
      javascript: true,
      python: false,
      ruby: true,
    },
    enabled: true,
    additionalLanguages: ['go', 'rust'],
    openTabsContext: true,
  }),
  duoChatConfiguration: createFakePartial<DuoChatConfiguration>({
    enabled: true,
  }),
  httpProxyConfiguration: createFakePartial<httpAgentConfiguration>({
    ca: 'ca-cert',
    cert: 'cert-file',
    certKey: 'cert-key',
  }),
  securityScannerConfiguration: createFakePartial<SecurityScannerConfiguration>({
    enabled: true,
    scanFileOnSave: true,
  }),
});
