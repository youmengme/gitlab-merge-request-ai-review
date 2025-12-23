import { BaseLanguageClient } from 'vscode-languageclient';
import {
  TelemetryNotificationType,
  TRACKING_EVENTS,
  CODE_SUGGESTIONS_CATEGORY,
} from '@gitlab-org/gitlab-lsp';

export const CODE_SUGGESTION_STREAM_ACCEPTED_COMMAND = 'gl.codeSuggestionStreamAccepted';
// Used for telemetry
export const codeSuggestionStreamAccepted =
  (client: BaseLanguageClient) => async (trackingId: string) => {
    await client?.sendNotification(TelemetryNotificationType.method, {
      category: CODE_SUGGESTIONS_CATEGORY,
      action: TRACKING_EVENTS.ACCEPTED,
      context: { trackingId },
    });
  };
