import * as vscode from 'vscode';
import { CONFIG_NAMESPACE } from '../constants';
import {
  DUO_CODE_SUGGESTIONS_CONFIG_NAMESPACE,
  DUO_CODE_SUGGESTIONS_LANGUAGES,
} from '../code_suggestions/constants';
import { SECURITY_SCANNER_NAMESPACE } from '../security_scans/constants';
import { isArrayOfString, isBoolean, isRecordOfStringBoolean } from './type_predicates';
import { getConfigurationTargetForKey } from './get_configuration_target_for_key';

// These constants represent `settings.json` keys. Other constants belong to `constants.ts`.
export const GITLAB_DEBUG_MODE = 'gitlab.debug';
export const DUO_CODE_SUGGESTIONS_MODE = 'gitlab.duoCodeSuggestions.enabled';
export const DUO_CODE_SUGGESTIONS_SUPPORTED_LANGUAGES =
  'gitlab.duoCodeSuggestions.enabledSupportedLanguages';
export const DUO_CODE_SUGGESTIONS_USER_LANGUAGES = 'gitlab.duoCodeSuggestions.additionalLanguages';

export const DUO_ENABLE_WITHOUT_GITLAB_PROJECT = 'gitlab.duo.enabledWithoutGitlabProject';
export const GITLAB_BRANCH_PROTECTION = 'gitlab.branchProtection';
export const DUO_CHAT_CONFIG_NAMESPACE = 'gitlab.duoChat';
export const DUO_AGENT_PLATFORM_CONFIG_NAMESPACE = 'gitlab.duoAgentPlatform';

export interface DuoWorkflowConfiguration {}

export interface DuoAgentPlatformConfiguration {
  enabled: boolean;
  connectionType: 'grpc' | 'websocket';
  defaultNamespace: string;
  editFileDiffBehavior: 'foreground' | 'background' | 'none';
}

export interface DuoConfiguration {
  enabledWithoutGitLabProject: boolean;
  workflow: DuoWorkflowConfiguration;
  agentPlatform: DuoAgentPlatformConfiguration;
}

export interface DuoChatConfiguration {
  enabled: boolean;
}

export interface DuoCodeSuggestionsConfiguration {
  enabled: boolean;
  suggestionsCache?: object; // Optional as does not define contributes.configuration
  additionalLanguages: string[];
  enabledSupportedLanguages: Record<string, boolean>;
  openTabsContext: boolean;
}

export interface httpAgentConfiguration {
  ca?: string;
  cert?: string;
  certKey?: string;
}

export interface SecurityScannerConfiguration {
  enabled: boolean;
  scanFileOnSave: boolean;
}

// VS Code returns a value or `null` but undefined is better for using default function arguments
export function turnNullToUndefined<T>(val: T | null | undefined): T | undefined {
  return val ?? undefined;
}

const booleanOrDefault = (val: unknown, defaultValue: boolean): boolean =>
  isBoolean(val) ? val : defaultValue;

function getAdditionalLanguages(
  config: vscode.WorkspaceConfiguration,
): DuoCodeSuggestionsConfiguration['additionalLanguages'] {
  const value = config.get('additionalLanguages');
  return isArrayOfString(value) ? value : [];
}

function getEnabledSupportedLanguages(
  config: vscode.WorkspaceConfiguration,
): DuoCodeSuggestionsConfiguration['enabledSupportedLanguages'] {
  const value = config.get('enabledSupportedLanguages');
  return isRecordOfStringBoolean(value) ? value : {};
}

export function getDuoCodeSuggestionsConfiguration(): DuoCodeSuggestionsConfiguration {
  const duoCodeSuggestionsConfig = vscode.workspace.getConfiguration(
    DUO_CODE_SUGGESTIONS_CONFIG_NAMESPACE,
  );

  return {
    enabled: booleanOrDefault(duoCodeSuggestionsConfig.enabled, true),
    suggestionsCache: duoCodeSuggestionsConfig.suggestionsCache,
    additionalLanguages: getAdditionalLanguages(duoCodeSuggestionsConfig),
    enabledSupportedLanguages: getEnabledSupportedLanguages(duoCodeSuggestionsConfig),
    openTabsContext: booleanOrDefault(duoCodeSuggestionsConfig.openTabsContext, true),
  };
}

export function getAgentPlatformConfiguration(): DuoAgentPlatformConfiguration {
  const duoAgentPlatformConfig = vscode.workspace.getConfiguration(
    DUO_AGENT_PLATFORM_CONFIG_NAMESPACE,
  );

  return {
    enabled: booleanOrDefault(duoAgentPlatformConfig.enabled, true),
    connectionType: duoAgentPlatformConfig.connectionType ?? 'websocket',
    defaultNamespace: duoAgentPlatformConfig.defaultNamespace,
    editFileDiffBehavior: duoAgentPlatformConfig.editFileDiffBehavior ?? 'foreground',
  };
}

export function getDuoChatConfiguration(): DuoChatConfiguration {
  const duoChatConfig = vscode.workspace.getConfiguration(DUO_CHAT_CONFIG_NAMESPACE);
  return {
    enabled: booleanOrDefault(duoChatConfig.enabled, true),
  };
}

export function getSecurityScannerConfiguration(): SecurityScannerConfiguration {
  const securityScannerConfig = vscode.workspace.getConfiguration(SECURITY_SCANNER_NAMESPACE);
  return {
    enabled: securityScannerConfig.enabled ?? false,
    scanFileOnSave: securityScannerConfig.scanFileOnSave,
  };
}

export function getHttpAgentConfiguration(): httpAgentConfiguration {
  const workspaceConfig = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  return {
    ca: workspaceConfig.ca,
    cert: workspaceConfig.cert,
    certKey: workspaceConfig.certKey,
  };
}

/**
 * Calls `config.update` but uses `getConfigurationTargetForKey` to make
 * sure we pick the right ConfigurationTarget
 */
const updateConfig = <T>(config: vscode.WorkspaceConfiguration, key: string, value: T) => {
  const target = getConfigurationTargetForKey(config, key);
  return config.update(key, value, target);
};

/**
 * Set 'gitlab.duoCodeSuggestions' configuration values from the given object.
 *
 * To remove a configuration key, use `undefined` as the value. This behavior
 * comes from the underlying `WorkspaceConfiguration#update` method.
 *
 * To avoid unnecessary writes to user and/or workspace configuration files,
 * only provide object properties for settings that will actually change. In
 * other words:
 *
 *     // Bad
 *     setDuoCodeSuggestionsConfiguration({
 *       ...getDuoCodeSuggestionsConfiguration(),
 *       foo,
 *       bar,
 *     })
 *
 *     // Good
 *     setDuoCodeSuggestionsConfiguration({
 *       foo,
 *       bar,
 *     })
 */
export async function setDuoCodeSuggestionsConfiguration(
  config: Partial<DuoCodeSuggestionsConfiguration>,
) {
  const duoCodeSuggestionsConfig = vscode.workspace.getConfiguration(
    DUO_CODE_SUGGESTIONS_CONFIG_NAMESPACE,
  );

  for (const [key, value] of Object.entries(config)) {
    // eslint-disable-next-line no-await-in-loop
    await updateConfig(duoCodeSuggestionsConfig, key, value);
  }
}

/**
 * Transform the given `enabledSupportedLanguages` configuration value into an
 * array of disabled, supported languages. This distinction is necessary as the
 * setting is presented as a checklist of enabled supported languages, but the
 * language server expects a list of disabled languages.
 *
 * See https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp/-/issues/174
 * for more details.
 */
export const parseDisabledSupportedLanguages = (
  enabledSupportedLanguages: DuoCodeSuggestionsConfiguration['enabledSupportedLanguages'],
): string[] =>
  Object.entries(enabledSupportedLanguages).reduce((acc: string[], [languageId, isEnabled]) => {
    if (!isEnabled) acc.push(languageId);

    return acc;
  }, []);

export const getDuoCodeSuggestionsLanguages = () => {
  const { additionalLanguages: enabledUnsupported, enabledSupportedLanguages } =
    getDuoCodeSuggestionsConfiguration();
  const disabledSupported = parseDisabledSupportedLanguages(enabledSupportedLanguages);

  const languages = new Set(DUO_CODE_SUGGESTIONS_LANGUAGES);

  for (const language of enabledUnsupported) {
    languages.add(language);
  }

  for (const language of disabledSupported) {
    languages.delete(language);
  }

  return Array.from(languages);
};
