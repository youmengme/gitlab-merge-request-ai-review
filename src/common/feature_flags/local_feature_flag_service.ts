import * as vscode from 'vscode';
import { diffEmitter } from '../utils/diff_emitter';
import { extensionConfigurationService } from '../utils/extension_configuration_service';
import { FEATURE_FLAGS_DEFAULT_VALUES, FeatureFlag } from './constants';
import { setFeatureFlagContext } from './utils';

export { FeatureFlag, FEATURE_FLAGS_DEFAULT_VALUES } from './constants';

export type AllFeatureFlags = Record<FeatureFlag, boolean>;

/** @deprecated Use getLocalFeatureFlagService().isEnabled() instead */
export function isEnabled(feature: FeatureFlag): boolean {
  const featureFlagUserPreferences = extensionConfigurationService.getConfiguration()?.featureFlags;
  const configurationValue = featureFlagUserPreferences?.[feature];
  const defaultValue = FEATURE_FLAGS_DEFAULT_VALUES[feature];

  return typeof configurationValue === 'boolean' ? configurationValue : defaultValue;
}

export interface LocalFeatureFlagService {
  isEnabled(flag: FeatureFlag): boolean;
}

export class DefaultLocalFeatureFlagService implements LocalFeatureFlagService, vscode.Disposable {
  readonly #disposables: vscode.Disposable[] = [];

  readonly #onChangeEmitter = diffEmitter(new vscode.EventEmitter<AllFeatureFlags>());

  #localFeatureFlags: AllFeatureFlags = FEATURE_FLAGS_DEFAULT_VALUES;

  constructor() {
    this.#updateLocalFeatureFlags();

    this.#disposables.push(
      extensionConfigurationService.onChange(async () => {
        this.#updateLocalFeatureFlags();
      }),
    );
  }

  isEnabled(flag: FeatureFlag) {
    return this.#localFeatureFlags[flag];
  }

  #updateLocalFeatureFlags() {
    const allFeatureFlags: AllFeatureFlags = { ...FEATURE_FLAGS_DEFAULT_VALUES };
    Object.values(FeatureFlag).forEach(feature =>
      setFeatureFlagContext(feature, isEnabled(feature)),
    );
    Object.values(FeatureFlag).forEach(feature => {
      allFeatureFlags[feature] = isEnabled(feature);
    });
    this.#localFeatureFlags = allFeatureFlags;
    this.#onChangeEmitter.fire(allFeatureFlags);
  }

  dispose(): void {
    this.#disposables.forEach(ch => ch.dispose());
  }
}

const service = new DefaultLocalFeatureFlagService();

export const getLocalFeatureFlagService = (): LocalFeatureFlagService => {
  return service;
};
