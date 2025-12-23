import * as vscode from 'vscode';
import { isEqual } from 'lodash';
import { CONFIG_NAMESPACE } from '../constants';
import { CustomQuery } from '../gitlab/custom_query';
import { FeatureFlag } from '../feature_flags/constants';
import { DuoConfiguration, turnNullToUndefined } from './extension_configuration';

export interface ExtensionConfiguration {
  pipelineGitRemoteName?: string;
  debug: boolean;
  /** this is an undocumented setting to help us test telemetry changes by pointing them to local snowplow instance */
  trackingUrl: string;
  ignoreCertificateErrors: boolean;
  featureFlags: Partial<Record<FeatureFlag, boolean>>;
  customQueries: CustomQuery[];
  duo: DuoConfiguration;
}

export class ExtensionConfigurationService {
  readonly #disposables: vscode.Disposable[] = [];

  readonly #onChangeEmitter = new vscode.EventEmitter<ExtensionConfiguration>();

  onChange = this.#onChangeEmitter.event;

  constructor() {
    this.#onChangeEmitter.fire(this.getConfiguration());

    this.#disposables.push(
      // Add this to listen for configuration changes
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(CONFIG_NAMESPACE)) {
          this.#onChangeEmitter.fire(this.getConfiguration());
        }
      }),
    );
  }

  getConfiguration(): ExtensionConfiguration {
    const workspaceConfig = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

    return {
      duo: {
        enabledWithoutGitLabProject: workspaceConfig?.duo?.enabledWithoutGitlabProject,
        workflow: {},
        agentPlatform: {
          enabled: workspaceConfig.duoAgentPlatform?.enabled ?? true,
          connectionType: workspaceConfig.duoAgentPlatform?.connectionType ?? 'websocket',
          defaultNamespace: workspaceConfig?.duoAgentPlatform?.defaultNamespace,
          editFileDiffBehavior:
            workspaceConfig.duoAgentPlatform?.editFileDiffBehavior ?? 'foreground',
        },
      },
      pipelineGitRemoteName: turnNullToUndefined(workspaceConfig?.pipelineGitRemoteName),
      featureFlags: workspaceConfig?.featureFlags ?? {},
      debug: workspaceConfig?.debug || false,
      ignoreCertificateErrors: workspaceConfig?.ignoreCertificateErrors || false,
      customQueries: workspaceConfig?.customQueries || [],
      trackingUrl: turnNullToUndefined(workspaceConfig?.trackingUrl),
    };
  }

  getChangedConfigurationJSON(): Record<string, unknown> {
    const workspaceConfig = vscode.workspace.getConfiguration();
    const jsonConfig = vscode.extensions.getExtension('Gitlab.gitlab-workflow')?.packageJSON;

    const configurationKeys: string[] = [];
    if (
      jsonConfig?.contributes?.configuration &&
      Array.isArray(jsonConfig.contributes.configuration)
    ) {
      for (const config of jsonConfig.contributes.configuration) {
        if (config.properties) {
          configurationKeys.push(...Object.keys(config.properties));
        }
      }
    }

    const changedValues: Record<string, unknown> = {};

    for (const fullKey of configurationKeys) {
      const inspection = workspaceConfig.inspect(fullKey);
      if (inspection) {
        const currentValue = workspaceConfig.get(fullKey);
        const { defaultValue } = inspection;

        if (!isEqual(currentValue, defaultValue)) {
          changedValues[fullKey] = currentValue;
        }
      }
    }

    return changedValues;
  }

  dispose(): void {
    this.#disposables.forEach(ch => ch.dispose());
  }
}

export const extensionConfigurationService = new ExtensionConfigurationService();
