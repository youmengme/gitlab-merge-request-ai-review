import { v4 as uuid } from 'uuid';
import { log } from '../log';
import { Snowplow } from '../snowplow/snowplow';

export enum CodeSuggestionTelemetryState {
  REQUESTED = 'suggestion_requested',
  LOADED = 'suggestion_loaded',
  ERROR = 'suggestion_error',
  SHOWN = 'suggestion_shown',
  ACCEPTED = 'suggestion_accepted',
  REJECTED = 'suggestion_rejected',
  CANCELLED = 'suggestion_cancelled',
  NOT_PROVIDED = 'suggestion_not_provided',
}

export enum RejectCodeSuggestionReason {
  DeletingSingleCharacter = 'deleting_single_character',
  TypingRepeatedSpaces = 'typing_repeated_spaces',
  UnchangedDocument = 'unchanged_document',
}

const stateGraph = new Map<CodeSuggestionTelemetryState, CodeSuggestionTelemetryState[]>([
  [
    CodeSuggestionTelemetryState.REQUESTED,
    [CodeSuggestionTelemetryState.LOADED, CodeSuggestionTelemetryState.ERROR],
  ],
  [
    CodeSuggestionTelemetryState.LOADED,
    [
      CodeSuggestionTelemetryState.SHOWN,
      CodeSuggestionTelemetryState.CANCELLED,
      CodeSuggestionTelemetryState.NOT_PROVIDED,
    ],
  ],
  [
    CodeSuggestionTelemetryState.SHOWN,
    [CodeSuggestionTelemetryState.ACCEPTED, CodeSuggestionTelemetryState.REJECTED],
  ],
  [
    CodeSuggestionTelemetryState.ERROR,
    [
      /* end state no transition allowed */
    ],
  ],
  [
    CodeSuggestionTelemetryState.CANCELLED,
    [
      /* end state no transition allowed */
    ],
  ],
  [
    CodeSuggestionTelemetryState.NOT_PROVIDED,
    [
      /* end state no transition allowed */
    ],
  ],
  [
    CodeSuggestionTelemetryState.REJECTED,
    [
      /* end state no transition allowed */
    ],
  ],
  [
    CodeSuggestionTelemetryState.ACCEPTED,
    [
      /* end state no transition allowed */
    ],
  ],
]);

type GitlabRealm = 'saas' | 'self-managed';

interface CodeSuggestion {
  id: string;
  state: CodeSuggestionTelemetryState;
  language: string;
  gitlabRealm: GitlabRealm;
  statusCode: number | undefined;
  modelEngine: string | undefined;
  modelName: string | undefined;
}

const endStates = [...stateGraph]
  .filter(([, allowedTransitions]) => allowedTransitions.length === 0)
  .map(([state]) => state);

const GC_TIME = 60000;

export class CodeSuggestionsTelemetryManager {
  // eslint-disable-next-line no-use-before-define
  static #instance: CodeSuggestionsTelemetryManager;

  #suggestions: Map<string, CodeSuggestion>;

  // constructors can't be made private with #
  // eslint-disable-next-line no-restricted-syntax
  private constructor() {
    this.#suggestions = new Map<string, CodeSuggestion>();
  }

  static createSuggestion(language: string, gitlabRealm: GitlabRealm): string {
    log.debug(`Telemetry: Received request to create a new suggestion`);

    this.rejectOpenedSuggestions();

    const suggestionID = uuid();
    // Garbage collect after time
    setTimeout(() => {
      if (this.getInstance().#suggestions.has(suggestionID)) {
        this.getInstance().#suggestions.delete(suggestionID);
      }
    }, GC_TIME);

    const suggestion = {
      id: suggestionID,
      state: CodeSuggestionTelemetryState.REQUESTED,
      language,
      gitlabRealm,
      statusCode: undefined,
      modelEngine: undefined,
      modelName: undefined,
    };
    this.getInstance().#suggestions.set(suggestionID, suggestion);
    this.sendTelemetry(suggestionID).catch(e => log.warn('could not track telemetry', e));

    log.debug(`Telemetry: New suggestion ${suggestionID} has been requested`);

    return suggestionID;
  }

  static rejectOpenedSuggestions() {
    log.debug(`Telemetry: Reject all opened suggestions`);

    this.getInstance().#suggestions.forEach((suggestion, suggestionID) => {
      if (endStates.includes(suggestion.state)) {
        return;
      }

      this.updateSuggestionState(suggestionID, CodeSuggestionTelemetryState.REJECTED);
    });
  }

  static setSuggestionModel(suggestionID: string, modelName: string, modelEngine: string) {
    log.debug(`Telemetry: Received request to set model for suggestion ${suggestionID}`);

    const suggestion = this.getInstance().#suggestions.get(suggestionID);
    if (!suggestion) {
      log.debug(`Telemetry: The suggestion with ${suggestionID} can't be found`);
      return;
    }

    this.getInstance().#suggestions.set(suggestionID, { ...suggestion, modelName, modelEngine });
  }

  static setSuggestionStatusCode(suggestionID: string, statusCode?: number): void {
    log.debug(`Telemetry: Received request to set error code for suggestion ${suggestionID}`);

    const suggestion = this.getInstance().#suggestions.get(suggestionID);
    if (!suggestion) {
      return;
    }

    this.getInstance().#suggestions.set(suggestionID, {
      ...suggestion,
      statusCode,
    });
  }

  static updateSuggestionState(suggestionID: string, newState: CodeSuggestionTelemetryState): void {
    log.debug(`Telemetry: Transist ${suggestionID} to ${newState}`);

    const currentSuggestion = this.getInstance().#suggestions.get(suggestionID);
    if (!currentSuggestion) {
      log.debug(`Telemetry: The suggestion with ${suggestionID} can't be found`);
      return;
    }

    const currentState = currentSuggestion.state;
    const allowedTransitions = stateGraph.get(currentState);
    if (!allowedTransitions) {
      log.debug(
        `Telemetry: The suggestion's ${suggestionID} state ${currentState} can't be found in state graph`,
      );
      return;
    }

    if (!allowedTransitions.includes(newState)) {
      log.debug(
        `Telemetry: Unexpected transition from ${currentState} into ${newState} for ${suggestionID}`,
      );
      if (newState !== CodeSuggestionTelemetryState.ACCEPTED) {
        return;
      }

      log.debug(
        `Telemetry: Conditionally allowing transition to accepted state for ${suggestionID}`,
      );
    }

    this.getInstance().#suggestions.set(suggestionID, { ...currentSuggestion, state: newState });
    this.sendTelemetry(suggestionID).catch(e => log.warn('could not track telemetry', e));

    log.debug(`Telemetry: ${suggestionID} transisted from ${currentState} to ${newState}`);
  }

  /* getInstance private static method that checks if
   * this.instance is initialized and if not
   * initializes it.
   */
  static getInstance(): CodeSuggestionsTelemetryManager {
    if (!this.#instance) {
      this.#instance = new CodeSuggestionsTelemetryManager();
    }

    return this.#instance;
  }

  static async rejectSuggestionRequest(reason: RejectCodeSuggestionReason) {
    log.debug(`Telemetry: Sending event for rejected suggestion request. Reason "${reason}".`);

    await Snowplow.getInstance().trackStructEvent(
      {
        category: 'code_suggestions',
        action: 'suggestion_request_rejected',
        label: reason,
      },
      ['ide-extension-context'],
    );
  }

  static async sendTelemetry(suggestionID: string) {
    log.debug(`Telemetry: Sending event for suggestion ${suggestionID}`);

    const suggestion = this.getInstance().#suggestions.get(suggestionID);

    if (!suggestion) {
      log.debug(`Telemetry: The suggestion with ${suggestionID} can't be found`);
      return;
    }

    const codeSuggestionContexts = {
      schema: 'iglu:com.gitlab/code_suggestions_context/jsonschema/2-0-1',
      data: {
        language: suggestion.language,
        user_agent: 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        gitlab_realm: suggestion.gitlabRealm,
        model_name: suggestion.modelName,
        model_engine: suggestion.modelEngine,
        api_status_code: suggestion.statusCode,
      },
    };

    await Snowplow.getInstance().trackStructEvent(
      {
        category: 'code_suggestions',
        action: suggestion.state,
        label: suggestionID,
      },
      ['ide-extension-context', codeSuggestionContexts],
    );
  }
}
