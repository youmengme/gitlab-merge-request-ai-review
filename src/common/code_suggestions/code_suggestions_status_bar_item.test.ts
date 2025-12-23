import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { SHOW_QUICK_PICK_MENU } from '../duo_quick_pick/commands/show_quick_pick_menu';
import {
  CODE_SUGGESTION_LABEL,
  CODE_SUGGESTIONS_STATUSES,
  CodeSuggestionsStatusBarItem,
} from './code_suggestions_status_bar_item';
import {
  CodeSuggestionsStateManager,
  VisibleCodeSuggestionsState,
} from './code_suggestions_state_manager';

jest.mock('./code_suggestions');

const createFakeItem = (): vscode.StatusBarItem =>
  ({
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  }) as unknown as vscode.StatusBarItem;

const DefaultVisibleState = VisibleCodeSuggestionsState.DISABLED_BY_USER;

describe('code suggestions status bar item', () => {
  let fakeStatusBarItem: vscode.StatusBarItem;
  let codeSuggestionsStateManager: CodeSuggestionsStateManager;
  let codeSuggestionsStatusBarItem: CodeSuggestionsStatusBarItem;
  let visibleState: VisibleCodeSuggestionsState;
  let notifyStateChange: () => void;

  beforeEach(() => {
    jest.mocked(vscode.window.createStatusBarItem).mockImplementation(() => {
      fakeStatusBarItem = createFakeItem();
      return fakeStatusBarItem;
    });
    codeSuggestionsStateManager = createFakePartial<CodeSuggestionsStateManager>({
      getVisibleState: () => visibleState,
      onDidChangeVisibleState: l => {
        notifyStateChange = () => l(visibleState);
        return { dispose: () => {} };
      },
    });
    visibleState = DefaultVisibleState;
    codeSuggestionsStatusBarItem = new CodeSuggestionsStatusBarItem(codeSuggestionsStateManager);
  });

  afterEach(() => {
    codeSuggestionsStatusBarItem.dispose();
  });

  it('renders as disabled by default', () => {
    expect(fakeStatusBarItem.text).toBe(
      `$(gitlab-code-suggestions-disabled) ${CODE_SUGGESTION_LABEL}`,
    );
  });

  it.each(Object.keys(CODE_SUGGESTIONS_STATUSES))(
    'renders state %s',
    (state: VisibleCodeSuggestionsState) => {
      visibleState = state;
      notifyStateChange();

      expect(fakeStatusBarItem.text).toBe(
        `$(${CODE_SUGGESTIONS_STATUSES[state].iconName}) ${CODE_SUGGESTION_LABEL}`,
      );
    },
  );

  it.each([VisibleCodeSuggestionsState.LOADING])(
    'should not render state %s',
    (state: VisibleCodeSuggestionsState) => {
      visibleState = state;
      notifyStateChange();

      expect(fakeStatusBarItem.text).toBe(
        `$(${CODE_SUGGESTIONS_STATUSES[DefaultVisibleState].iconName}) ${CODE_SUGGESTION_LABEL}`,
      );
    },
  );

  it.each([
    VisibleCodeSuggestionsState.NO_LICENSE,
    VisibleCodeSuggestionsState.ERROR,
    VisibleCodeSuggestionsState.SUGGESTIONS_API_ERROR,
  ])('should render error color for state %s', (state: VisibleCodeSuggestionsState) => {
    visibleState = state;
    notifyStateChange();

    expect(fakeStatusBarItem.backgroundColor).toStrictEqual(
      new vscode.ThemeColor('statusBarItem.errorBackground'),
    );
  });

  it.each([VisibleCodeSuggestionsState.NO_LICENSE])(
    'should render expected tooltip text for state %s',
    (state: VisibleCodeSuggestionsState) => {
      visibleState = state;
      notifyStateChange();

      expect(fakeStatusBarItem.tooltip).toBe('GitLab Duo failed diagnostic checks.');
    },
  );

  it('uses correct command for toggling showing the quick pick menu', () => {
    expect(fakeStatusBarItem.command).toBe(SHOW_QUICK_PICK_MENU);
  });
});
