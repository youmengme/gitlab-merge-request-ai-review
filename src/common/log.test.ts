import { DetailedError } from './errors/common';
import { initializeLogging, log } from './log';
import {
  extensionConfigurationService,
  ExtensionConfiguration,
} from './utils/extension_configuration_service';

jest.mock('./utils/extension_configuration_service');

type LogLevels = keyof typeof log;

describe('logging', () => {
  afterEach(() => {
    expect.hasAssertions();
  });

  let logFunction: jest.Mock;

  beforeEach(() => {
    logFunction = jest.fn();
    initializeLogging(logFunction);
  });

  const getLoggedMessage = () => logFunction.mock.calls[0][0];

  describe('log', () => {
    beforeEach(() => {
      jest
        .spyOn(extensionConfigurationService, 'getConfiguration')
        .mockReturnValue({ debug: true } as ExtensionConfiguration);
    });

    it('passes the argument to the handler', () => {
      const message = 'A very bad error occurred';
      log.info(message);
      expect(logFunction).toBeCalledTimes(1);
      expect(getLoggedMessage()).toContain(`[info]: ${message}`);
    });

    it.each`
      methodName | logLevel
      ${'debug'} | ${'debug'}
      ${'info'}  | ${'info'}
      ${'warn'}  | ${'warning'}
      ${'error'} | ${'error'}
    `(
      'it handles log level "$logLevel"',
      ({ methodName, logLevel }: { methodName: LogLevels; logLevel: string }) => {
        log[methodName]('message');
        expect(getLoggedMessage()).toContain(`[${logLevel}]: message`);
      },
    );

    it('does not log debug messages if debug mode is disabled', () => {
      jest
        .spyOn(extensionConfigurationService, 'getConfiguration')
        .mockReturnValue({ debug: false } as ExtensionConfiguration);

      log.debug('message');

      expect(logFunction).not.toBeCalled();
    });

    it('indents multiline messages', () => {
      log.error('error happened\nand the next line\nexplains why');
      expect(getLoggedMessage()).toContain(
        `[error]: error happened\n    and the next line\n    explains why`,
      );
    });
  });

  describe('log Error', () => {
    describe('for normal errors', () => {
      it('passes the argument to the handler', () => {
        const message = 'A very bad error occurred';
        const error = {
          message,
          stack: 'stack',
        };
        log.error(error as Error);
        expect(getLoggedMessage()).toMatch(/\[error\]: A very bad error occurred\s+stack/m);
      });
    });

    describe('for detailed errors', () => {
      it('passes the details to the handler', () => {
        const message = 'Could not fetch from GitLab: error 404';
        log.error({
          details: { message },
        } as unknown as DetailedError);
        const logFunctionArgument = logFunction.mock.calls[0][0];
        expect(logFunctionArgument).toMatch(/\[error\]:/);
        expect(logFunctionArgument).toMatch(message);
      });
    });
  });
});
