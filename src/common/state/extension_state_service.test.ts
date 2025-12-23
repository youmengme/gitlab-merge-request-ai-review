import * as vscode from 'vscode';
import {
  DefaultExtensionStateService,
  StateKey,
  ExtensionStateProvider,
} from './extension_state_service';

describe('DefaultExtensionStateService', () => {
  let service: DefaultExtensionStateService;
  let key: StateKey<string>;
  let provider: ExtensionStateProvider<string>;
  let eventEmitter: vscode.EventEmitter<string>;

  beforeEach(() => {
    service = new DefaultExtensionStateService();
    key = 'testKey' as StateKey<string>;
    eventEmitter = new vscode.EventEmitter<string>();
    provider = {
      state: 'initialState',
      onChange: eventEmitter.event,
    };
    service.addStateProvider(key, provider);
  });

  it('retrieves state provider', () => {
    const retrievedProvider = service.get(key);
    expect(retrievedProvider).toBe(provider);
    expect(retrievedProvider.state).toBe(provider.state);
  });

  it('should notify subscribers on change', () => {
    const listener = jest.fn();
    service.onChange(listener);

    provider.state = 'newState';
    eventEmitter.fire('newState');

    const retrievedProvider = service.get(key);
    expect(retrievedProvider.state).toBe('newState');
  });

  it('should throw error when getting unregistered key', () => {
    const missingKey = 'missing' as StateKey<string>;
    expect(() => service.get(missingKey)).toThrow(`No state provider registered for key: missing`);
  });
});
