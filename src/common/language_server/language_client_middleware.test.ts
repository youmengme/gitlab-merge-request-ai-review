import vscode from 'vscode';
import { BaseLanguageClient, TextDocumentPositionParams } from 'vscode-languageclient';
import {
  CODE_SUGGESTIONS_CATEGORY,
  START_STREAMING_COMMAND,
  SUGGESTION_ACCEPTED_COMMAND,
  TelemetryNotificationType,
  TRACKING_EVENTS,
} from '@gitlab-org/gitlab-lsp';
import { ProvideInlineCompletionItemsSignature } from 'vscode-languageclient/lib/common/inlineCompletion';
import { CodeSuggestionsStateManager } from '../code_suggestions/code_suggestions_state_manager';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { setFakeWorkspaceConfiguration } from '../test_utils/vscode_fakes';
import { createExtensionContext } from '../test_utils/entities';
import { LanguageClientMiddleware } from './language_client_middleware';

jest.mock('lodash', () => {
  const allLodash = jest.requireActual('lodash');

  return {
    ...allLodash,
    uniqueId: (prefix: string) => `${prefix}uniqueId`,
  };
});

describe('LanguageClientMiddleware', () => {
  let stateManager: CodeSuggestionsStateManager;

  beforeEach(() => {
    jest.useFakeTimers();

    stateManager = new CodeSuggestionsStateManager(
      createFakePartial<GitLabPlatformManager>({
        onAccountChange: jest.fn().mockReturnValue({
          dispose: () => {},
        }),
      }),
      createExtensionContext(),
    );
    jest.spyOn(stateManager, 'setLoading');
    jest.spyOn(stateManager, 'isActive').mockReturnValue(true);
  });

  it('disables standard completion - provideCompletionItem always returns empty array', () => {
    const middleware = new LanguageClientMiddleware(stateManager);
    expect(middleware.provideCompletionItem()).toEqual([]);
  });

  describe('provideInlineCompletionItem', () => {
    const d = createFakePartial<vscode.TextDocument>({
      uri: vscode.Uri.parse('file:///home/user/dev/test.md'),
    });
    const p = createFakePartial<vscode.Position>({
      character: 7,
      line: 77,
    });
    const ctx = createFakePartial<vscode.InlineCompletionContext>({});

    let cancellationTokenSource: vscode.CancellationTokenSource;
    let token: vscode.CancellationToken;

    beforeEach(() => {
      cancellationTokenSource = new vscode.CancellationTokenSource();
      token = cancellationTokenSource.token;
    });

    describe('when streaming is disabled', () => {
      beforeEach(() => {
        setFakeWorkspaceConfiguration({
          featureFlags: {
            streamCodeGenerations: false,
          },
        });
      });

      it('returns empty array if suggestions are not active', async () => {
        jest.spyOn(stateManager, 'isActive').mockReturnValue(false);
        const middleware = new LanguageClientMiddleware(stateManager);
        const next = jest.fn();

        const result = await middleware.provideInlineCompletionItems(
          d,
          p,
          ctx,
          cancellationTokenSource.token,
          next,
        );

        expect(result).toEqual([]);
        expect(next).not.toHaveBeenCalled();
      });

      describe('when suggestions are active', () => {
        let middleware: LanguageClientMiddleware;
        const client = createFakePartial<BaseLanguageClient>({
          sendRequest: jest.fn(),
          sendNotification: jest.fn(),
        });

        beforeEach(() => {
          jest.spyOn(stateManager, 'isActive').mockReturnValue(true);
          middleware = new LanguageClientMiddleware(stateManager);
          middleware.client = client;
        });

        it('calls through to default logic if suggestions are enabled', async () => {
          const mockItem = createFakePartial<vscode.InlineCompletionItem>({});
          const next = jest.fn().mockResolvedValue([mockItem]);

          const result = await middleware.provideInlineCompletionItems(
            d,
            p,
            ctx,
            cancellationTokenSource.token,
            next,
          );

          expect(result).toEqual([mockItem]);
        });

        it('runs command to track telemetry "suggestion shown" event', async () => {
          const uniqueTrackingId = 'trackingId';
          const mockItem = createFakePartial<vscode.InlineCompletionItem>({
            insertText: 'log(',
            command: {
              command: SUGGESTION_ACCEPTED_COMMAND,
              arguments: [uniqueTrackingId],
            },
          });
          const next = jest.fn().mockResolvedValue({ items: [mockItem] });

          await middleware.provideInlineCompletionItems(
            d,
            p,
            ctx,
            cancellationTokenSource.token,
            next,
          );

          expect(client.sendNotification).toHaveBeenCalledWith(TelemetryNotificationType.method, {
            action: TRACKING_EVENTS.SHOWN,
            category: CODE_SUGGESTIONS_CATEGORY,
            context: {
              trackingId: uniqueTrackingId,
            },
          });
        });

        it('sets suggestions to loading state', async () => {
          const next = jest.fn().mockResolvedValue([]);

          await middleware.provideInlineCompletionItems(
            d,
            p,
            ctx,
            cancellationTokenSource.token,
            next,
          );

          expect(jest.mocked(stateManager.setLoading).mock.calls).toEqual([[true], [false]]);
        });

        it('sets loading to false even if fetching suggestions throws an error', async () => {
          const next = jest.fn().mockRejectedValue('Failed to fetch');
          await middleware.provideInlineCompletionItems(
            d,
            p,
            ctx,
            cancellationTokenSource.token,
            next,
          );

          expect(jest.mocked(stateManager.setLoading).mock.calls).toEqual([[true], [false]]);
        });

        it('sets loading to false if token is canceled and next never resolves', async () => {
          const next = jest.fn().mockReturnValue(new Promise(() => {}));

          const result = middleware.provideInlineCompletionItems(
            d,
            p,
            ctx,
            cancellationTokenSource.token,
            next,
          );

          // why: We need to flush some promises before we cancel
          await jest.runOnlyPendingTimersAsync();
          cancellationTokenSource.cancel();
          await jest.advanceTimersByTimeAsync(150);

          await expect(result).resolves.toEqual([]);
          expect(jest.mocked(stateManager.setLoading).mock.calls).toEqual([[true], [false]]);
        });
      });
    });

    describe('when streaming is enabled', () => {
      let nextSpy: ProvideInlineCompletionItemsSignature;
      let middleware: LanguageClientMiddleware;
      const streamId = 'code-suggestion-stream-LS-id';
      const uniqueTrackingId = 'tracking-id';

      beforeEach(() => {
        nextSpy = jest.fn().mockResolvedValue({
          items: [
            {
              insertText: '',
              command: {
                command: START_STREAMING_COMMAND,
                arguments: [streamId, uniqueTrackingId],
              },
            },
          ],
        });

        setFakeWorkspaceConfiguration({
          featureFlags: {
            streamCodeGenerations: true,
          },
        });

        middleware = new LanguageClientMiddleware(stateManager);
      });

      it('calls the inlineCompletion (next) if client is not set', async () => {
        const mockItem = createFakePartial<vscode.InlineCompletionItem>({});
        const nextReturnsItem = jest.fn().mockResolvedValue([mockItem]);
        const result = (await middleware.provideInlineCompletionItems(
          d,
          p,
          ctx,
          token,
          nextReturnsItem,
        )) as vscode.InlineCompletionItem[];

        expect(result).toEqual([mockItem]);
        expect(nextSpy).not.toHaveBeenCalled();
      });

      describe('when the language client is set', () => {
        let client: BaseLanguageClient;

        beforeEach(() => {
          jest.useRealTimers();

          const asTextDocumentPositionParams = jest.fn();

          client = createFakePartial<BaseLanguageClient>({
            sendNotification: jest.fn().mockImplementation(() => Promise.resolve()),
            code2ProtocolConverter: {
              asTextDocumentPositionParams,
            },
            onNotification: jest.fn().mockImplementation(() => Promise.resolve()),
          });

          middleware.client = client;

          asTextDocumentPositionParams.mockReturnValue({
            textDocument: {
              uri: 'uri',
            },
            position: {
              line: 0,
              character: 0,
            },
          } as TextDocumentPositionParams);
        });

        function invokeNotifications(list: unknown[]) {
          return jest.fn((_, callback) => {
            for (const element of list) {
              setTimeout(() => {
                const notificationData = element;
                callback(notificationData);
              }, 0);
            }

            return {
              dispose: () => {},
            };
          });
        }

        describe('streaming', () => {
          it('keeps receiving notifications until done', async () => {
            client.onNotification = invokeNotifications([
              { id: streamId, completion: 'test', done: false },
              { id: streamId, completion: '', done: true },
            ]);

            const result = (await middleware.provideInlineCompletionItems(
              d,
              p,
              ctx,
              token,
              nextSpy,
            )) as vscode.InlineCompletionItem[];

            expect(result[0].insertText).toEqual('test');
          });

          it('returns the existing response if position does not change', async () => {
            client.onNotification = invokeNotifications([
              { id: streamId, completion: 'test 123', done: false },
              { id: streamId, completion: '', done: true },
            ]);

            const result = (await middleware.provideInlineCompletionItems(
              d,
              p,
              ctx,
              token,
              nextSpy,
            )) as vscode.InlineCompletionItem[];

            expect(result[0].insertText).toEqual('test 123');
          });

          it('handles `setLoading` gracefully', async () => {
            client.onNotification = invokeNotifications([
              { id: streamId, completion: 'test', done: false },
              { id: streamId, completion: 'test 123', done: false },
              { id: streamId, completion: 'test 123 abc', done: true },
            ]);

            await middleware.provideInlineCompletionItems(d, p, ctx, token, jest.fn());

            expect(jest.mocked(stateManager.setLoading).mock.calls).toEqual([
              [true], // generation request started
              [false], // generation request ended
            ]);
          });

          it('when canceled, handles `setLoading` gracefully', async () => {
            client.onNotification = invokeNotifications([
              { id: streamId, completion: 'test', done: false },
              { id: streamId, completion: 'test 123', done: false },
            ]);

            const result = middleware.provideInlineCompletionItems(d, p, ctx, token, jest.fn());

            cancellationTokenSource.cancel();

            await result;

            expect(jest.mocked(stateManager.setLoading).mock.calls).toEqual([
              [true], // generation request started
              [false], // generation request ended
            ]);
          });

          it('runs command to track telemetry "suggestion shown" event', async () => {
            client.onNotification = invokeNotifications([
              { id: streamId, completion: 'test', done: false },
              { id: streamId, completion: '', done: true },
            ]);

            await middleware.provideInlineCompletionItems(d, p, ctx, token, nextSpy);

            expect(client.sendNotification).toHaveBeenCalledWith(TelemetryNotificationType.method, {
              action: TRACKING_EVENTS.SHOWN,
              category: CODE_SUGGESTIONS_CATEGORY,
              context: {
                trackingId: uniqueTrackingId,
              },
            });
          });
        });
      });
    });
  });
});
