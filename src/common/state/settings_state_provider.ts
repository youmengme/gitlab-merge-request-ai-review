import * as vscode from 'vscode';
import {
  ExtensionConfiguration,
  ExtensionConfigurationService,
} from '../utils/extension_configuration_service';
import {
  DuoChatConfiguration,
  DuoCodeSuggestionsConfiguration,
  getDuoChatConfiguration,
  getDuoCodeSuggestionsConfiguration,
  getHttpAgentConfiguration,
  getSecurityScannerConfiguration,
  httpAgentConfiguration,
  SecurityScannerConfiguration,
} from '../utils/extension_configuration';
import { ExtensionStateProvider, StateKey } from './extension_state_service';

export interface SettingsDetails {
  extensionConfiguration: ExtensionConfiguration;
  duoCodeSuggestionsConfiguration: DuoCodeSuggestionsConfiguration;
  duoChatConfiguration: DuoChatConfiguration;
  httpProxyConfiguration: httpAgentConfiguration;
  securityScannerConfiguration: SecurityScannerConfiguration;
}

export const SettingsDetailsStateKey = 'SettingsDetailsState' as StateKey<SettingsDetails>;

export class SettingsStateProvider implements ExtensionStateProvider<SettingsDetails> {
  #eventEmitter = new vscode.EventEmitter<SettingsDetails>();

  #configurationService: ExtensionConfigurationService;

  onChange = this.#eventEmitter.event;

  constructor(configurationService: ExtensionConfigurationService) {
    this.#configurationService = configurationService;
    this.#configurationService.onChange(() => {
      this.#eventEmitter.fire(this.state);
    });
  }

  get state(): SettingsDetails {
    return {
      extensionConfiguration: this.#configurationService.getConfiguration(),
      duoCodeSuggestionsConfiguration: getDuoCodeSuggestionsConfiguration(),
      duoChatConfiguration: getDuoChatConfiguration(),
      httpProxyConfiguration: getHttpAgentConfiguration(),
      securityScannerConfiguration: getSecurityScannerConfiguration(),
    };
  }
}
