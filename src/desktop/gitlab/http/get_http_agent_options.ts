import * as fs from 'fs';
import * as vscode from 'vscode';
import { UserFriendlyError } from '../../../common/errors/user_friendly_error';
import { handleError } from '../../../common/errors/handle_error';

export interface GitLabHttpAgentOptions {
  ca?: Buffer;
  cert?: Buffer;
  key?: Buffer;
  proxy?: string;
  rejectUnauthorized?: boolean;
  keepAlive?: boolean;
}

export const getHttpAgentOptions = (): GitLabHttpAgentOptions => {
  const result: GitLabHttpAgentOptions = { keepAlive: true };
  // FIXME: if you are touching this configuration statement, move the configuration to extension_configuration.ts
  const { ignoreCertificateErrors, ca, cert, certKey } =
    vscode.workspace.getConfiguration('gitlab');

  result.rejectUnauthorized = !ignoreCertificateErrors;
  if (ca) {
    try {
      result.ca = fs.readFileSync(ca);
    } catch (e) {
      handleError(new UserFriendlyError(`Cannot read CA '${ca}'`, e));
    }
  }
  if (cert) {
    try {
      result.cert = fs.readFileSync(cert);
    } catch (e) {
      handleError(new UserFriendlyError(`Cannot read Certificate '${cert}'`, e));
    }
  }
  if (certKey) {
    try {
      result.key = fs.readFileSync(certKey);
    } catch (e) {
      handleError(new UserFriendlyError(`Cannot read Certificate Key '${certKey}'`, e));
    }
  }

  // FIXME: if you are touching this configuration statement, move the configuration to extension_configuration.ts
  const { proxy } = vscode.workspace.getConfiguration('http');
  result.proxy = proxy || undefined;
  return result;
};
