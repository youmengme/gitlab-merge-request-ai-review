import * as vscode from 'vscode';
import { WEB_IDE_AUTH_PROVIDER_ID, WEB_IDE_AUTH_SCOPE } from '../../common/platform/web_ide';
import { WebIdeAuthentication } from './web_ide_authentication';

const INIT_AUTH_SESSION: vscode.AuthenticationSession = {
  accessToken: 'test-access-token',
  account: {
    id: 'test-id',
    label: 'test-label',
  },
  id: 'test-id',
  scopes: ['test-scope'],
};
const NEXT_AUTH_SESSION = { ...INIT_AUTH_SESSION, accessToken: 'next-access-token' };
const WEB_IDE_PROVIDER: vscode.AuthenticationProviderInformation = {
  id: WEB_IDE_AUTH_PROVIDER_ID,
  label: 'Web IDE',
};
const OTHER_PROVIDER: vscode.AuthenticationProviderInformation = {
  id: 'other-provider',
  label: 'Other Provider',
};

describe('WebIdeAuthentication', () => {
  let subject: WebIdeAuthentication;
  let onChangeSpy: () => void;

  const triggerDidChangeSessions = (provider: vscode.AuthenticationProviderInformation) => {
    jest.mocked(vscode.authentication.onDidChangeSessions).mock.calls.forEach(([listener]) => {
      listener({ provider });
    });
  };

  beforeEach(() => {
    jest.spyOn(vscode.authentication, 'onDidChangeSessions').mockImplementation();
    jest.spyOn(vscode.authentication, 'getSession').mockResolvedValue(NEXT_AUTH_SESSION);

    onChangeSpy = jest.fn();

    subject = new WebIdeAuthentication(INIT_AUTH_SESSION);
    subject.onChange(onChangeSpy);
  });

  it('does not trigger onChange', () => {
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  describe('getSession', () => {
    it('returns init session', () => {
      expect(subject.getSession()).toBe(INIT_AUTH_SESSION);
    });
  });

  describe('when onDidChangeSessions is triggered with web ide provider', () => {
    beforeEach(() => {
      triggerDidChangeSessions(WEB_IDE_PROVIDER);
    });

    it('triggers onChange', () => {
      expect(onChangeSpy).toHaveBeenCalled();
    });

    it('requests new session', () => {
      expect(vscode.authentication.getSession).toHaveBeenCalledTimes(1);
      expect(vscode.authentication.getSession).toHaveBeenCalledWith(
        WEB_IDE_AUTH_PROVIDER_ID,
        [WEB_IDE_AUTH_SCOPE],
        {
          createIfNone: false,
          silent: true,
        },
      );
    });

    it('getSession, returns new session', () => {
      expect(subject.getSession()).toBe(NEXT_AUTH_SESSION);
    });
  });

  describe('when onDidChangeSessions is triggered with unknown provider', () => {
    beforeEach(() => {
      triggerDidChangeSessions(OTHER_PROVIDER);
    });

    it('does not trigger onChange', () => {
      expect(onChangeSpy).not.toHaveBeenCalled();
    });

    it('does request new session', () => {
      expect(vscode.authentication.getSession).not.toHaveBeenCalled();
    });

    it('getSession, does not change', () => {
      expect(subject.getSession()).toBe(INIT_AUTH_SESSION);
    });
  });
});
