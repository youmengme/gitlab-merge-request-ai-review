import vscode, { Extension } from 'vscode';
import { InMemoryMemento } from '../../test/integration/test_infrastructure/in_memory_memento';
import { createFakePartial } from '../common/test_utils/create_fake_partial';
import { setupYamlSupport } from './yaml_support';
import { DO_NOT_SHOW_YAML_SUGGESTION } from './constants';

const confirmationMessageArguments = [
  "Would you like to install Red Hat's YAML extension to get real-time linting on the .gitlab-ci.yml file?",
  'Yes',
  'Not now',
  "Don't show again",
];

describe('yaml support', () => {
  let suggestionResponse: undefined | string;

  let fileName: string;

  let triggerOnDidOpenDocumentEvent: () => void;

  let context: vscode.ExtensionContext;

  let onDidOpenTextDocument: jest.Mock;
  let showInformationMessage: jest.Mock;
  const setup = async () => {
    setupYamlSupport(context);
    await triggerOnDidOpenDocumentEvent?.();
  };

  beforeEach(() => {
    fileName = '';
    context = createFakePartial<vscode.ExtensionContext>({
      globalState: new InMemoryMemento(),
    });
    onDidOpenTextDocument = jest.fn(cb => {
      triggerOnDidOpenDocumentEvent = () => cb({ fileName });
    });
    showInformationMessage = jest.fn(() => Promise.resolve(suggestionResponse));
    (vscode.window.showInformationMessage as jest.Mock).mockImplementation(showInformationMessage);
    (vscode.workspace.onDidOpenTextDocument as jest.Mock).mockImplementation(onDidOpenTextDocument);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('does nothing if extension is already installed', async () => {
    (vscode.extensions.getExtension as jest.Mock).mockImplementation(
      () => ({}) as Extension<unknown>,
    );
    await setup();
    expect(onDidOpenTextDocument).not.toBeCalled();
  });

  it('does nothing if suggestion has been dismissed', async () => {
    await context.globalState.update(DO_NOT_SHOW_YAML_SUGGESTION, true);
    await setup();
    await triggerOnDidOpenDocumentEvent();
    expect(showInformationMessage).not.toBeCalled();
  });

  describe('when file opened', () => {
    describe('when is yaml file', () => {
      beforeEach(() => {
        fileName = '.gitlab-ci.yml';
      });

      it('shows information message once per session', async () => {
        await setup();
        expect(showInformationMessage.mock.calls).toEqual([confirmationMessageArguments]);

        await triggerOnDidOpenDocumentEvent();
        expect(showInformationMessage.mock.calls).toEqual([confirmationMessageArguments]);
      });

      describe("when clicked 'Do not show again'", () => {
        beforeEach(async () => {
          suggestionResponse = "Don't show again";
          await setup();
          await triggerOnDidOpenDocumentEvent();
        });

        it('shows information message once', () => {
          expect(showInformationMessage.mock.calls).toEqual([confirmationMessageArguments]);
        });

        it('stores dismissal in globalState', () => {
          expect(context.globalState.get(DO_NOT_SHOW_YAML_SUGGESTION)).toBe(true);
        });
      });
    });

    describe('when is not yaml file', () => {
      beforeEach(() => {
        fileName = 'README.md';
      });

      it('does nothing', async () => {
        await setup();
        expect(showInformationMessage).not.toHaveBeenCalled();
      });
    });
  });
});
