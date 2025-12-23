import {
  CHAT,
  CODE_SUGGESTIONS,
  FeatureState,
  FeatureStateCheck,
  StateCheckId,
  STATE_CHECK_USER_READABLE_LABELS,
  UNSUPPORTED_LANGUAGE,
  CHAT_TERMINAL_CONTEXT,
  AGENTIC_CHAT,
  FLOWS,
} from '@gitlab-org/gitlab-lsp';
import { DiagnosticsRenderer, DiagnosticsSection } from '../diagnostics_service';
import {
  AllFeaturesState,
  LanguageServerFeatureStateKey,
} from '../../language_server/language_server_feature_state_provider';

const checkEnabledMapper = ({ engaged, checkId }: FeatureStateCheck<StateCheckId>) =>
  `- [${engaged ? ' ' : 'x'}] ${STATE_CHECK_USER_READABLE_LABELS[checkId]} (${engaged ? 'false' : 'true'})`;

const createFeatureStateDiagnosticsSection = (
  title: string,
  checks: FeatureState,
): DiagnosticsSection => {
  // UNSUPPORTED_LANGUAGE check returns false by default on markdown files
  const diagnosticsChecks = checks.allChecks.filter(
    ch => STATE_CHECK_USER_READABLE_LABELS[ch.checkId] && ch.checkId !== UNSUPPORTED_LANGUAGE,
  );
  const onOff = diagnosticsChecks.find(ch => ch.engaged) ? 'Off' : 'On';

  return {
    title: `${title} (${onOff})`,
    content: diagnosticsChecks.map(checkEnabledMapper).join('\n') || '',
  };
};

export class FeatureStateDiagnosticsRenderer implements DiagnosticsRenderer<[AllFeaturesState]> {
  keys = [LanguageServerFeatureStateKey] as const;

  render([state]: [AllFeaturesState]): DiagnosticsSection[] {
    if (state[CODE_SUGGESTIONS].allChecks.length === 0 && state[CHAT].allChecks.length === 0) {
      return [];
    }

    return [
      createFeatureStateDiagnosticsSection('GitLab Duo Code Suggestions', state[CODE_SUGGESTIONS]),
      createFeatureStateDiagnosticsSection('GitLab Duo Chat', state[CHAT]),
      createFeatureStateDiagnosticsSection('Terminal Context', state[CHAT_TERMINAL_CONTEXT]),
      createFeatureStateDiagnosticsSection('GitLab Agentic Chat', state[AGENTIC_CHAT]),
      createFeatureStateDiagnosticsSection('GitLab Flows', state[FLOWS]),
    ];
  }
}
