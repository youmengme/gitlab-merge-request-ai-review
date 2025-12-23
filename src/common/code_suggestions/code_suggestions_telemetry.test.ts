import * as vscode from 'vscode';
import { compareBy } from '../utils/compare_by';
import {
  CodeSuggestionsTelemetry,
  Experiment,
  Model,
  Telemetry,
} from './code_suggestions_telemetry';

describe('CodeSuggestionsTelemetry', () => {
  let telemetry: CodeSuggestionsTelemetry;

  const codegenModel: Model = {
    engine: 'gitlab-native',
    name: 'codegen-v2-1.0.0',
    lang: 'c',
  };

  const experiments: Experiment[] = [
    {
      name: 'exp_truncate_suffix',
      variant: 0,
    },
    {
      name: 'exp_trim_completions',
      variant: 1,
    },
  ];

  const codegenTelemetry: Telemetry = {
    model_name: codegenModel.name,
    model_engine: codegenModel.engine,
    lang: codegenModel.lang,
    experiments: [],
    accepts: 0,
    errors: 0,
    requests: 0,
  };

  beforeEach(() => {
    telemetry = new CodeSuggestionsTelemetry();
  });

  describe('when telemetry is enabled', () => {
    beforeEach(() => {
      // @ts-expect-error vscode is mocked, so it is writable here
      vscode.env.isTelemetryEnabled = true;
    });

    it('stores experiments', () => {
      telemetry.storeExperiments(codegenModel, experiments);

      expect(telemetry.toArray()).toEqual([{ ...codegenTelemetry, experiments }]);
    });

    it('increases request count', () => {
      telemetry.incRequestCount(codegenModel);

      expect(telemetry.toArray()).toEqual([{ ...codegenTelemetry, requests: 1 }]);
    });

    it('increases accept count', () => {
      telemetry.incAcceptCount(codegenModel);

      expect(telemetry.toArray()).toEqual([{ ...codegenTelemetry, accepts: 1 }]);
    });

    it('increases error count', () => {
      telemetry.incErrorCount(codegenModel);

      expect(telemetry.toArray()).toEqual([{ ...codegenTelemetry, errors: 1 }]);
    });

    it('handles multiple models', () => {
      const bisonModel: Model = {
        engine: 'code-bison',
        name: 'v2-1.0.0',
        lang: 'python',
      };

      telemetry.storeExperiments(codegenModel, experiments);
      telemetry.incRequestCount(codegenModel);
      telemetry.incAcceptCount(codegenModel);

      telemetry.storeExperiments(bisonModel, experiments);
      telemetry.incRequestCount(bisonModel);
      telemetry.incErrorCount(bisonModel);

      expect(telemetry.toArray().sort(compareBy('model_engine'))).toEqual([
        {
          model_engine: bisonModel.engine,
          model_name: bisonModel.name,
          lang: bisonModel.lang,
          experiments,
          requests: 1,
          errors: 1,
          accepts: 0,
        },
        { ...codegenTelemetry, experiments, requests: 1, accepts: 1 },
      ]);
    });
  });

  describe('when telemetry is disabled', () => {
    beforeEach(() => {
      // @ts-expect-error vscode is mocked, so it is writable here
      vscode.env.isTelemetryEnabled = false;

      telemetry.storeExperiments(codegenModel, experiments);
      telemetry.incRequestCount(codegenModel);
      telemetry.incAcceptCount(codegenModel);
      telemetry.incErrorCount(codegenModel);
    });

    it('does not expose any telemetry data', () => {
      expect(telemetry.toArray()).toEqual([]);
    });

    it('exposes tracked stats when telemetry becomes enabled', () => {
      // @ts-expect-error vscode is mocked, so it is writable here
      vscode.env.isTelemetryEnabled = true;

      expect(telemetry.toArray()).toEqual([
        { ...codegenTelemetry, experiments, accepts: 1, errors: 1, requests: 1 },
      ]);
    });
  });
});
