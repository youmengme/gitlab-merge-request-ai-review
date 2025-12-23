import vscode from 'vscode';
import {
  BaseLanguageClient,
  CancellationTokenSource,
  Middleware,
  RegistrationParams,
  RegistrationRequest,
} from 'vscode-languageclient';
import {
  CancelStreamingNotificationType,
  START_STREAMING_COMMAND,
  SUGGESTION_ACCEPTED_COMMAND,
  StreamingCompletionResponseNotificationType,
  TelemetryNotificationType,
  CODE_SUGGESTIONS_CATEGORY,
  TRACKING_EVENTS,
} from '@gitlab-org/gitlab-lsp';
import { CodeSuggestionsStateManager } from '../code_suggestions/code_suggestions_state_manager';
import { waitForCancellationToken } from '../utils/wait_for_cancellation_token';
import { waitForMs } from '../utils/wait_for_ms';
import { log } from '../log';
import { CODE_SUGGESTION_STREAM_ACCEPTED_COMMAND } from '../code_suggestions/commands/code_suggestion_stream_accepted';
import { isInlineCompletionList } from '../utils/code_suggestions';
import { doNotAwait } from '../utils/do_not_await';
import { serializeInlineCompletionContext } from './serialization_utils';
import { GenerationIndicator } from './generation_indicator';

// We need to wait just a bit after cancellation, otherwise the loading icon flickers while someone types
const CANCELLATION_DELAY = 150;

export class LanguageClientMiddleware implements Middleware {
  #stateManager: CodeSuggestionsStateManager;

  #subscriptions: vscode.Disposable[] = [];

  #client?: BaseLanguageClient;

  constructor(stateManager: CodeSuggestionsStateManager) {
    this.#stateManager = stateManager;
  }

  dispose() {
    this.#subscriptions.forEach(s => s.dispose());
  }

  set client(client: BaseLanguageClient) {
    this.#client = client;
  }

  // we disable standard completion from LS and only use inline completion

  provideCompletionItem = () => [];

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
    next: (
      document: vscode.TextDocument,
      position: vscode.Position,
      context: vscode.InlineCompletionContext,
      token: vscode.CancellationToken,
    ) => vscode.ProviderResult<vscode.InlineCompletionItem[] | vscode.InlineCompletionList>,
  ) {
    if (!this.#stateManager.isActive()) {
      return [];
    }

    try {
      this.#stateManager.setLoading(true);

      // Short circuit after both cancellation and time have passed
      const shortCircuit = waitForCancellationToken(token)
        .then(() => waitForMs(CANCELLATION_DELAY))
        .then(() => []);

      const response = await Promise.race([
        shortCircuit,
        next(document, position, serializeInlineCompletionContext(context), token),
      ]);

      let uniqueTrackingId;

      if (isInlineCompletionList(response)) {
        const { command, arguments: args } = response?.items?.[0]?.command ?? {};

        if (command === SUGGESTION_ACCEPTED_COMMAND) {
          const [trackingId] = args ?? [];
          uniqueTrackingId = trackingId;
        }

        if (command === START_STREAMING_COMMAND) {
          const [streamId, trackingId] = args ?? [];
          uniqueTrackingId = trackingId;
          return await this.#listenToIncomingStream(position, token, streamId, uniqueTrackingId);
        }
      }

      this.#trackSuggestionShown(uniqueTrackingId);

      return response;
    } catch (e) {
      log.error(e);
      return [];
    } finally {
      this.#stateManager.setLoading(false);
    }
  }

  async #listenToIncomingStream(
    position: vscode.Position,
    token: vscode.CancellationToken,
    streamId: string,
    uniqueTrackingId: string,
  ): Promise<vscode.InlineCompletionItem[]> {
    log.debug(`Duo Code Suggestion Generation (Stream ID: ${streamId}): Started listening`);
    const indicator = new GenerationIndicator();
    indicator.start();
    return new Promise<vscode.InlineCompletionItem[]>(resolve => {
      if (!this.#client) {
        log.error(
          'Invoking LanguageServer client without initializing the inline completion middleware',
        );
        resolve([]);
        return;
      }
      let lastCompletion = '';
      token.onCancellationRequested(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.#client?.sendNotification(CancelStreamingNotificationType, { id: streamId });
        log.debug(`Duo Code Suggestion Generation (Stream ID: ${streamId}): Cancelled`);
        resolve([]);
      });
      this.#client.onNotification(
        StreamingCompletionResponseNotificationType,
        ({ id, completion, done }) => {
          // exit when the notification is from a different stream
          if (id !== streamId) return;

          // `token.onCancellationRequested` callback already handles cancellations
          if (token.isCancellationRequested) return;

          // exit if we are not done and the completion is an empty string
          if (!done && !completion) return;

          indicator.increment();

          // cache the last response because the completion is missing in the last stream notification
          lastCompletion = completion || lastCompletion;

          if (done) {
            log.debug(
              `Duo Code Suggestion Generation (Stream ID: ${streamId}): Showing suggestion`,
            );

            this.#trackSuggestionShown(uniqueTrackingId);

            const acceptedCommand: vscode.Command = {
              title: 'Code Suggestion Stream Accepted',
              command: CODE_SUGGESTION_STREAM_ACCEPTED_COMMAND,
              arguments: [uniqueTrackingId],
            };
            resolve([
              new vscode.InlineCompletionItem(
                lastCompletion,
                new vscode.Range(position, position),
                acceptedCommand,
              ),
            ]);
          }
        },
      );
    }).finally(() => indicator.dispose());
  }

  /**
   * Log the registration params for observability
   */
  handleRegisterCapability = async (
    params: RegistrationParams,
    next: RegistrationRequest.HandlerSignature,
  ): Promise<void> => {
    const cancellation = new CancellationTokenSource();
    for (const registration of params.registrations) {
      log.info(`handleRegisterCapability: ${JSON.stringify(registration, null, 2)}`);
    }

    await next(params, cancellation.token);
  };

  #trackSuggestionShown(trackingId?: string) {
    if (!this.#client || !trackingId) return;

    doNotAwait(
      this.#client.sendNotification(TelemetryNotificationType.method, {
        category: CODE_SUGGESTIONS_CATEGORY,
        action: TRACKING_EVENTS.SHOWN,
        context: { trackingId },
      }),
    );
  }
}
