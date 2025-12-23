import * as vscode from 'vscode';
import { diffEmitter } from '../../utils/diff_emitter';
import { AllFeatureFlags, LocalFeatureFlagService } from '../local_feature_flag_service';
import { FEATURE_FLAGS_DEFAULT_VALUES, FeatureFlag } from '../constants';

export class TestLocalFeatureFlagService implements LocalFeatureFlagService {
  #onChangeEmitter = diffEmitter(new vscode.EventEmitter<AllFeatureFlags>());

  onChange = this.#onChangeEmitter.event;

  #localFeatureFlags: AllFeatureFlags = FEATURE_FLAGS_DEFAULT_VALUES;

  constructor(flags: Partial<AllFeatureFlags>) {
    this.#localFeatureFlags = { ...this.#localFeatureFlags, ...flags };
  }

  fireChange() {
    this.#onChangeEmitter.fire(this.#localFeatureFlags);
  }

  isEnabled(flag: FeatureFlag) {
    return this.#localFeatureFlags[flag];
  }

  setFlags(flags: Partial<AllFeatureFlags>) {
    this.#localFeatureFlags = { ...this.#localFeatureFlags, ...flags };
  }
}
