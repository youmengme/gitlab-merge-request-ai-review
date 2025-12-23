import {
  DiagnosticsRenderer,
  DiagnosticsSection,
} from '../../common/diagnostics/diagnostics_service';
import {
  SettingsDetails,
  SettingsDetailsStateKey,
} from '../../common/state/settings_state_provider';
import {
  renderFeatureFlags,
  renderJSONSettings,
} from '../../common/diagnostics/settings_state_diagnostics/base_settings_diagnostics_renderer';

export class DesktopSettingsStateDiagnosticsRenderer
  implements DiagnosticsRenderer<[SettingsDetails]>
{
  keys = [SettingsDetailsStateKey] as const;

  render([settingsDetails]: [SettingsDetails]): DiagnosticsSection[] {
    const sectionRenderers = [renderFeatureFlags, renderJSONSettings];
    return [
      {
        title: 'GitLab Duo Agent Platform settings',
        content: sectionRenderers.map(sr => sr(settingsDetails)).join('\n'),
      },
    ];
  }
}
