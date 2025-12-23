import { Authentication } from './authentication';
import { NoopAuthentication } from './noop_authentication';
import { WebIdeAuthentication, getWebIdeAuthSession } from './web_ide_authentication';

export const resolveAuthentication = async (): Promise<Authentication> => {
  const authSession = await getWebIdeAuthSession();

  if (!authSession) {
    return new NoopAuthentication();
  }

  return new WebIdeAuthentication(authSession);
};
