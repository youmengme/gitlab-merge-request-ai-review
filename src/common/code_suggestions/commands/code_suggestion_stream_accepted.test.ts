import {
  TelemetryNotificationType,
  TRACKING_EVENTS,
  CODE_SUGGESTIONS_CATEGORY,
} from '@gitlab-org/gitlab-lsp';
import { BaseLanguageClient } from 'vscode-languageclient';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { codeSuggestionStreamAccepted } from './code_suggestion_stream_accepted';

describe('codeSuggestionStreamAccepted command', () => {
  const languageClient = createFakePartial<BaseLanguageClient>({
    sendNotification: jest.fn(),
  });
  const runCommand = codeSuggestionStreamAccepted(languageClient);

  beforeEach(async () => {
    await runCommand('uniqueTrackingId');
  });

  it('should send telemetry notification', () => {
    expect(languageClient.sendNotification).toHaveBeenCalledWith(TelemetryNotificationType.method, {
      action: TRACKING_EVENTS.ACCEPTED,
      category: CODE_SUGGESTIONS_CATEGORY,
      context: {
        trackingId: 'uniqueTrackingId',
      },
    });
  });
});
