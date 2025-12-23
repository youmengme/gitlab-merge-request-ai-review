import * as vscode from 'vscode';
import {
  ApiRequest,
  COMMAND_FETCH_FROM_API,
  COMMAND_MEDIATOR_TOKEN,
} from '../../common/platform/web_ide';
import { MediatorCommandsApiClient } from './mediator_commands_api_client';

const TEST_REQUEST: ApiRequest<string> = {
  type: 'rest',
  method: 'GET',
  path: '/test',
};
const TEST_RESPONSE = 'test-response';
const TEST_MEDIATOR_TOKEN = 'test-mediator-token';

describe('MediatorCommandsApiClient', () => {
  let subject: MediatorCommandsApiClient;

  beforeEach(() => {
    jest.spyOn(vscode.commands, 'executeCommand').mockImplementation(async key => {
      if (key === COMMAND_MEDIATOR_TOKEN) {
        return TEST_MEDIATOR_TOKEN;
      }
      if (key === COMMAND_FETCH_FROM_API) {
        return TEST_RESPONSE;
      }

      return undefined;
    });

    subject = new MediatorCommandsApiClient();
  });

  describe('fetchFromApi', () => {
    it('passes request to mediator command', async () => {
      const actual = await subject.fetchFromApi(TEST_REQUEST);

      expect(actual).toBe(TEST_RESPONSE);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        COMMAND_FETCH_FROM_API,
        TEST_MEDIATOR_TOKEN,
        TEST_REQUEST,
      );
    });

    it('requests mediator token only once', async () => {
      await subject.fetchFromApi(TEST_REQUEST);
      await subject.fetchFromApi(TEST_REQUEST);

      const mediatorCalls = jest
        .mocked(vscode.commands.executeCommand)
        .mock.calls.filter(([key]) => key === COMMAND_MEDIATOR_TOKEN);

      expect(mediatorCalls).toEqual([[COMMAND_MEDIATOR_TOKEN]]);
    });
  });
});
