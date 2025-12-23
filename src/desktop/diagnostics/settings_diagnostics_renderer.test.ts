import * as vscode from 'vscode';
import { SettingsDetails } from '../../common/state/settings_state_provider';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { createMockSettingsDetails } from '../../common/test_utils/diagnostics_configuration';
import { extensionConfigurationService } from '../../common/utils/extension_configuration_service';
import { DesktopSettingsStateDiagnosticsRenderer } from './settings_diagnostics_renderer';

describe('DesktopSettingsStateDiagnosticsRenderer', () => {
  let renderer: DesktopSettingsStateDiagnosticsRenderer;
  let mockSettingsDetails: SettingsDetails;

  beforeEach(() => {
    renderer = new DesktopSettingsStateDiagnosticsRenderer();

    mockSettingsDetails = createMockSettingsDetails();

    jest.mocked(vscode.workspace.getConfiguration).mockReturnValue(
      createFakePartial<vscode.WorkspaceConfiguration>({
        branchProtection: true,
        showPipelineUpdateNotifications: true,
      }),
    );
  });

  describe('render', () => {
    it('should render all section headers correctly', () => {
      jest.spyOn(extensionConfigurationService, 'getChangedConfigurationJSON').mockReturnValue({
        'gitlab.debug': true,
      });

      const result = renderer.render([mockSettingsDetails]);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('GitLab Duo Agent Platform settings');
      expect(result[0].content).toContain('### Feature flags');
      expect(result[0].content).toContain('### JSON Settings');
    });

    it('should render only feature flags when no JSON settings exist', () => {
      jest.spyOn(extensionConfigurationService, 'getChangedConfigurationJSON').mockReturnValue({});

      const result = renderer.render([mockSettingsDetails]);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('GitLab Duo Agent Platform settings');
      expect(result[0].content).toContain('### Feature flags');
      expect(result[0].content).not.toContain('### JSON Settings');
    });

    it('should render JSON settings when configuration values exist', () => {
      jest.spyOn(extensionConfigurationService, 'getChangedConfigurationJSON').mockReturnValue({
        'gitlab.debug': true,
        'gitlab.featureFlags': { testFlag: true },
      });

      const result = renderer.render([mockSettingsDetails]);

      expect(result[0].content).toContain('### JSON Settings');
      expect(result[0].content).toContain('```json');
      expect(result[0].content).toContain('"gitlab.debug": true');
    });
  });
});
