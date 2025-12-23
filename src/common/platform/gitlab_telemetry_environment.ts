import vscode from 'vscode';
import { createInterfaceId } from '@gitlab/needle';
import { IdeExtensionContext } from '../snowplow/snowplow_options';

export interface GitLabTelemetryEnvironment {
  isTelemetryEnabled(): boolean;
  onDidChangeTelemetryEnabled: vscode.Event<boolean>;
  dispose?: () => void;
  buildIdeExtensionContext: (extVersion: string) => IdeExtensionContext;
}

export const GitLabTelemetryEnvironmentId = createInterfaceId<GitLabTelemetryEnvironment>(
  'GitLabTelemetryEnvironment',
);
