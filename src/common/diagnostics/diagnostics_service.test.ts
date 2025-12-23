import * as vscode from 'vscode';
import { DefaultExtensionStateService, StateKey } from '../state/extension_state_service';
import { DefaultDiagnosticsService, DiagnosticsRenderer } from './diagnostics_service';

describe('DiagnosticsService', () => {
  let mockExtensionState: DefaultExtensionStateService;
  let service: DefaultDiagnosticsService;
  let defaultMockRenderer: DiagnosticsRenderer<[string]>;

  beforeEach(() => {
    mockExtensionState = new DefaultExtensionStateService();
    service = new DefaultDiagnosticsService(mockExtensionState);

    defaultMockRenderer = {
      keys: ['testKey' as StateKey<string>],
      render: ([state]) => [
        {
          title: 'testTitle',
          content: state,
        },
      ],
    };
    service.addRenderer(defaultMockRenderer);
    mockExtensionState.addStateProvider('testKey' as StateKey<string>, {
      state: 'testState',
      onChange: new vscode.EventEmitter<string>().event,
    });
  });

  it('returns the section created by registered renderers', () => {
    const sections = service.getSections();

    expect(sections[0].title).toEqual('testTitle');
    expect(sections[0].content).toEqual('testState');
  });
});
