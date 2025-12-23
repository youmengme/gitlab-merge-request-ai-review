import { SettingsDetails } from '../../state/settings_state_provider';
import { extensionConfigurationService } from '../../utils/extension_configuration_service';

export const renderFeatureFlags = (details: SettingsDetails): string => {
  const { featureFlags } = details.extensionConfiguration;

  const flagEntries = Object.entries(featureFlags).map(
    ([flagName, isEnabled]) =>
      `- [${isEnabled ? 'x' : ' '}] ${flagName} (${isEnabled ? 'enabled' : 'disabled'})`,
  );

  if (flagEntries.length === 0) {
    return '';
  }

  return ['### Feature flags', ...flagEntries].join('\n');
};

export const renderJSONSettings = (): string => {
  const jsonExtension = extensionConfigurationService.getChangedConfigurationJSON();
  if (!jsonExtension || Object.keys(jsonExtension).length === 0) {
    return '';
  }

  const formattedJSON = JSON.stringify(jsonExtension, null, 2);

  return [
    '\n### JSON Settings',
    '',
    'These are modified settings combined from your global `settings.json` and project-specific `settings.json`:',
    '',
    '```json',
    formattedJSON,
    '```',
  ].join('\n');
};
