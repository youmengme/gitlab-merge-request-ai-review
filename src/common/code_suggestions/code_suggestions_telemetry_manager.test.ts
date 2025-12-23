import { validate } from 'uuid';
import * as vscode from 'vscode';
import {
  CodeSuggestionsTelemetryManager,
  CodeSuggestionTelemetryState,
} from './code_suggestions_telemetry_manager';

jest.mock('../snowplow/snowplow', () => ({
  Snowplow: {
    getInstance: jest.fn().mockReturnValue({
      trackStructEvent: jest.fn(),
      ideExtensionContext: {
        schema: 'test',
        data: {
          ide_name: 'Visual Studio Code',
          ide_vendor: 'Microsoft Corporation',
          ide_version: '1.0.0',
          extension_name: 'GitLab Workflow',
          extension_version: '1.0.0',
        },
      },
    }),
  },
}));

const { trackStructEvent } = jest.requireMock('../snowplow/snowplow').Snowplow.getInstance();

describe('CodeSuggestionsTelemetryManager', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
  });

  it('should create a new suggestion', () => {
    const id = CodeSuggestionsTelemetryManager.createSuggestion('ts', 'saas');
    expect(validate(id)).toBe(true);
  });

  it('should send a state of requested when the suggestion is created', () => {
    trackStructEvent.mockResolvedValue(true);

    jest.mocked(vscode.extensions.getExtension).mockReturnValue({
      packageJSON: {
        name: 'gitlab-vscode-extension',
        version: '1.0.0',
      },
    } as unknown as vscode.Extension<unknown>);

    const codeSuggestionContexts = {
      schema: 'iglu:com.gitlab/code_suggestions_context/jsonschema/2-0-1',
      data: {
        language: 'ts',
        user_agent: 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        gitlab_realm: 'saas',
        model_name: undefined,
        model_engine: undefined,
      },
    };

    const id = CodeSuggestionsTelemetryManager.createSuggestion('ts', 'saas');

    expect(trackStructEvent).toHaveBeenCalledWith(
      {
        action: 'suggestion_requested',
        category: 'code_suggestions',
        label: id,
      },
      ['ide-extension-context', codeSuggestionContexts],
    );
  });

  it('should update state of an existing suggestion when transition is valid', () => {
    trackStructEvent.mockResolvedValue(true);

    const id = CodeSuggestionsTelemetryManager.createSuggestion('ts', 'saas');
    CodeSuggestionsTelemetryManager.updateSuggestionState(id, CodeSuggestionTelemetryState.LOADED);

    const codeSuggestionContexts = {
      schema: 'iglu:com.gitlab/code_suggestions_context/jsonschema/2-0-1',
      data: {
        language: 'ts',
        user_agent: 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        gitlab_realm: 'saas',
        model_name: undefined,
        model_engine: undefined,
      },
    };

    expect(trackStructEvent).toHaveBeenLastCalledWith(
      {
        action: 'suggestion_loaded',
        category: 'code_suggestions',
        label: id,
      },
      ['ide-extension-context', codeSuggestionContexts],
    );
  });

  it('should not update state of an existing suggestion when transition is invalid', () => {
    trackStructEvent.mockResolvedValue(true);

    const id = CodeSuggestionsTelemetryManager.createSuggestion('ts', 'saas');
    CodeSuggestionsTelemetryManager.updateSuggestionState(
      id,
      CodeSuggestionTelemetryState.REJECTED,
    );

    // It is only called for accepted
    expect(trackStructEvent).toHaveBeenCalledTimes(1);
  });

  it('should not update state if suggestion does not exist', () => {
    const nonExistentID = 'unknown';

    CodeSuggestionsTelemetryManager.updateSuggestionState(
      nonExistentID,
      CodeSuggestionTelemetryState.LOADED,
    );

    expect(trackStructEvent).not.toHaveBeenCalled();
  });

  it('should reject all open suggestions', () => {
    const id = CodeSuggestionsTelemetryManager.createSuggestion('ts', 'saas');
    CodeSuggestionsTelemetryManager.updateSuggestionState(id, CodeSuggestionTelemetryState.LOADED);
    CodeSuggestionsTelemetryManager.updateSuggestionState(id, CodeSuggestionTelemetryState.SHOWN);

    CodeSuggestionsTelemetryManager.createSuggestion('ts', 'saas');

    expect(trackStructEvent.mock.calls[0]).toEqual([
      expect.objectContaining({
        action: 'suggestion_requested',
        category: 'code_suggestions',
      }),
      expect.arrayContaining([expect.anything()]),
    ]);

    expect(trackStructEvent.mock.calls[1]).toEqual([
      expect.objectContaining({
        action: 'suggestion_loaded',
        category: 'code_suggestions',
      }),
      expect.arrayContaining([expect.anything()]),
    ]);

    expect(trackStructEvent.mock.calls[2]).toEqual([
      expect.objectContaining({
        action: 'suggestion_shown',
        category: 'code_suggestions',
      }),
      expect.arrayContaining([expect.anything()]),
    ]);

    expect(trackStructEvent.mock.calls[3]).toEqual([
      expect.objectContaining({
        action: 'suggestion_rejected',
        category: 'code_suggestions',
      }),
      expect.arrayContaining([expect.anything()]),
    ]);

    expect(trackStructEvent.mock.calls[4]).toEqual([
      expect.objectContaining({
        action: 'suggestion_requested',
        category: 'code_suggestions',
      }),
      expect.arrayContaining([expect.anything()]),
    ]);
  });

  it('should update model details of an existing suggestion', () => {
    trackStructEvent.mockResolvedValue(true);

    const id = CodeSuggestionsTelemetryManager.createSuggestion('ts', 'saas');
    CodeSuggestionsTelemetryManager.setSuggestionModel(id, 'modelName', 'modelEngine');
    CodeSuggestionsTelemetryManager.updateSuggestionState(id, CodeSuggestionTelemetryState.LOADED);

    const codeSuggestionContexts = {
      schema: 'iglu:com.gitlab/code_suggestions_context/jsonschema/2-0-1',
      data: {
        language: 'ts',
        user_agent: 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        gitlab_realm: 'saas',
        model_name: 'modelName',
        model_engine: 'modelEngine',
      },
    };

    expect(trackStructEvent).toHaveBeenLastCalledWith(
      {
        action: 'suggestion_loaded',
        category: 'code_suggestions',
        label: id,
      },
      ['ide-extension-context', codeSuggestionContexts],
    );
  });

  it('should set suggestion error code', () => {
    const id = CodeSuggestionsTelemetryManager.createSuggestion('ts', 'saas');

    CodeSuggestionsTelemetryManager.setSuggestionStatusCode(id, 200);
    CodeSuggestionsTelemetryManager.updateSuggestionState(id, CodeSuggestionTelemetryState.LOADED);

    const codeSuggestionContexts = {
      schema: 'iglu:com.gitlab/code_suggestions_context/jsonschema/2-0-1',
      data: {
        api_status_code: 200,
        language: 'ts',
        user_agent: 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        gitlab_realm: 'saas',
        model_name: undefined,
        model_engine: undefined,
      },
    };

    expect(trackStructEvent).toHaveBeenLastCalledWith(
      {
        action: 'suggestion_loaded',
        category: 'code_suggestions',
        label: id,
      },
      ['ide-extension-context', codeSuggestionContexts],
    );
  });
});
