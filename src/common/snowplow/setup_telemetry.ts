import * as vscode from 'vscode';
import type { GitLabTelemetryEnvironment } from '../platform/gitlab_telemetry_environment';
import { Snowplow } from './snowplow';
import { snowplowBaseOptions } from './snowplow_options';

export function setupTelemetry(
  context: vscode.ExtensionContext,
  telemetryEnv: GitLabTelemetryEnvironment,
): Snowplow {
  const extVersion = context.extension.packageJSON?.version || 'unknown';

  const snowplow = Snowplow.getInstance({
    ...snowplowBaseOptions,
    enabled: () => telemetryEnv.isTelemetryEnabled(),
    ideExtensionContext: telemetryEnv.buildIdeExtensionContext(extVersion),
  });

  return snowplow;
}
