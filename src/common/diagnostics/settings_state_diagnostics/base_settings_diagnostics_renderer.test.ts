import * as vscode from 'vscode';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { SettingsDetails } from '../../state/settings_state_provider';
import { createMockSettingsDetails } from '../../test_utils/diagnostics_configuration';
import { extensionConfigurationService } from '../../utils/extension_configuration_service';
import { renderFeatureFlags, renderJSONSettings } from './base_settings_diagnostics_renderer';

describe('Base Settings Diagnostics Renderer', () => {
  let mockSettingsDetails: SettingsDetails;

  beforeEach(() => {
    mockSettingsDetails = createMockSettingsDetails();

    jest.mocked(vscode.workspace.getConfiguration).mockReturnValue(
      createFakePartial<vscode.WorkspaceConfiguration>({
        branchProtection: true,
        showPipelineUpdateNotifications: true,
      }),
    );
  });

  it('should render Feature Flags section correctly', () => {
    const result = renderFeatureFlags(mockSettingsDetails);

    expect(result).toContain('### Feature flags');
    expect(result).toContain('- [x] languageServer (enabled)');
  });

  describe('edge cases', () => {
    it('should handle empty feature flags', () => {
      mockSettingsDetails.extensionConfiguration.featureFlags = {};
      const result = renderFeatureFlags(mockSettingsDetails);
      expect(result).not.toContain('### Feature Flags');
    });
  });

  describe('renderJSONSettings', () => {
    it('should render JSON settings when configuration values exist', () => {
      jest.spyOn(extensionConfigurationService, 'getChangedConfigurationJSON').mockReturnValue({
        'gitlab.debug': true,
        'gitlab.featureFlags': { testFlag: true },
      });

      const result = renderJSONSettings();

      expect(result).toContain('### JSON Settings');
      expect(result).toContain(
        'These are modified settings combined from your global `settings.json` and project-specific `settings.json`:',
      );
      expect(result).toContain('```json');
      expect(result).toContain('"gitlab.debug": true');
      expect(result).toContain('"gitlab.featureFlags"');
      expect(result).toContain('```');
    });

    it('should return empty string when no configuration values exist', () => {
      jest.spyOn(extensionConfigurationService, 'getChangedConfigurationJSON').mockReturnValue({});

      const result = renderJSONSettings();

      expect(result).toBe('');
    });

    it('should format JSON properly with indentation', () => {
      jest.spyOn(extensionConfigurationService, 'getChangedConfigurationJSON').mockReturnValue({
        'gitlab.debug': true,
        'gitlab.customQueries': ['query1', 'query2'],
      });

      const result = renderJSONSettings();

      expect(result).toContain(
        '{\n  "gitlab.debug": true,\n  "gitlab.customQueries": [\n    "query1",\n    "query2"\n  ]\n}',
      );
    });
  });
});
