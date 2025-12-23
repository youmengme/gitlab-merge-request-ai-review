import * as vscode from 'vscode';
import { log } from '../../log';
import { isBoolean, isArrayOfString, isRecordOfStringBoolean } from '../type_predicates';

const OLD_CONFIG_NAMESPACE = 'gitlab.aiAssistedCodeSuggestions';
const NEW_CONFIG_NAMESPACE = 'gitlab.duoCodeSuggestions';

const configMigrationMap = {
  openTabsContext: isBoolean,
  enabled: isBoolean,
  enabledSupportedLanguages: isRecordOfStringBoolean,
  additionalLanguages: isArrayOfString,
};

type ConfigTarget = {
  value: unknown;
  target: vscode.ConfigurationTarget;
  targetProperty: 'globalValue' | 'workspaceValue' | 'workspaceFolderValue';
};

/**
 * In version `v6.0.0` we renamed the config namespace `aiAssistedCodeSuggestions` to `duoCodeSuggestions`.
 * All settings within this namespace were impacted.
 *
 * This migration looks for any settings values within the old namespace, and migrates them to the new namespace.
 * Any settings that are not valid for the new namespace are removed.
 */
export async function renameAiAssistToDuo() {
  const config = vscode.workspace.getConfiguration();
  const migrationPromises = Object.entries(configMigrationMap).flatMap(([key, validator]) =>
    migrateConfigurationProperty(config, key, validator),
  );

  await Promise.all(migrationPromises);
}

function migrateConfigurationProperty(
  config: vscode.WorkspaceConfiguration,
  key: string,
  validator: (value: unknown) => boolean,
): Array<Thenable<void>> {
  const oldKey = `${OLD_CONFIG_NAMESPACE}.${key}`;
  const newKey = `${NEW_CONFIG_NAMESPACE}.${key}`;
  const inspection = config.inspect(oldKey);

  if (!inspection) return [];

  const targets = getConfigTargets(inspection);
  return targets.flatMap(target =>
    migrateConfigurationPropertyWithinSameTarget(config, oldKey, newKey, target, validator),
  );
}

function migrateConfigurationPropertyWithinSameTarget(
  config: vscode.WorkspaceConfiguration,
  oldKey: string,
  newKey: string,
  configTarget: ConfigTarget,
  validator: (value: unknown) => boolean,
): Array<Thenable<void>> {
  const migrationPromises: Array<Thenable<void>> = [];
  const newInspection = config.inspect(newKey);
  const { value, target, targetProperty } = configTarget;

  const needsNewValue = !newInspection || newInspection[targetProperty] === undefined;
  if (needsNewValue && validator(value)) {
    migrationPromises.push(config.update(newKey, value, target));
    log.info(
      `Config migration: adding new config "${newKey}": "${value}" to configuration target "${targetProperty}"`,
    );
  }

  migrationPromises.push(config.update(oldKey, undefined, target));
  log.info(
    `Config migration: removing deprecated config "${oldKey}" from configuration target "${targetProperty}"`,
  );

  return migrationPromises;
}

export type ConfigInspectionResult = NonNullable<
  ReturnType<vscode.WorkspaceConfiguration['inspect']>
>;
function getConfigTargets(inspection: ConfigInspectionResult): Array<ConfigTarget> {
  return [
    {
      value: inspection.globalValue,
      target: vscode.ConfigurationTarget.Global,
      targetProperty: 'globalValue' as const,
    },
    {
      value: inspection.workspaceValue,
      target: vscode.ConfigurationTarget.Workspace,
      targetProperty: 'workspaceValue' as const,
    },
    {
      value: inspection.workspaceFolderValue,
      target: vscode.ConfigurationTarget.WorkspaceFolder,
      targetProperty: 'workspaceFolderValue' as const,
    },
  ].filter(({ value }) => value !== undefined);
}
