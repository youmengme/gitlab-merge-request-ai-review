import * as vscode from 'vscode';
import { ExtensionStateService, StateKey } from '../state/extension_state_service';

export interface DiagnosticsSection {
  title: string;
  content: string;
}

export interface DiagnosticsRenderer<States extends unknown[]> {
  keys: Readonly<{
    [I in keyof States]: StateKey<States[I]>;
  }>;
  render(state: {
    [K in keyof States]: States[K];
  }): DiagnosticsSection[];
}

export interface DiagnosticsService {
  addRenderer(renderer: DiagnosticsRenderer<unknown[]>): void;
  onChange: vscode.Event<void>;
  getSections(): DiagnosticsSection[];
}

export class DefaultDiagnosticsService implements DiagnosticsService {
  #eventEmitter = new vscode.EventEmitter<void>();

  #renderers: DiagnosticsRenderer<unknown[]>[] = [];

  #subscriptions: vscode.Disposable[] = [];

  onChange = this.#eventEmitter.event;

  #extensionStateService: ExtensionStateService;

  constructor(extensionStateService: ExtensionStateService) {
    this.#extensionStateService = extensionStateService;
    this.#subscriptions.push(this.#extensionStateService.onChange(() => this.#eventEmitter.fire()));
  }

  addRenderer(renderer: DiagnosticsRenderer<unknown[]>): void {
    this.#renderers.push(renderer);
  }

  getSections(): DiagnosticsSection[] {
    return this.#renderers.flatMap(renderer => {
      const providers = renderer.keys.map(k => this.#extensionStateService.get(k));
      return renderer.render(providers.map(p => p.state));
    });
  }
}
