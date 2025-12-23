import { API_PULLING, pullHandler } from './pulling';

API_PULLING.interval = 1; // wait only 1ms between pulling attempts.

jest.spyOn(global, 'setTimeout');

describe('pullHandler', () => {
  let handler = jest.fn();

  beforeEach(() => {
    handler = jest.fn();
    handler.mockReturnValueOnce(undefined);
    handler.mockReturnValueOnce(undefined);
    handler.mockReturnValue(42);
  });

  it('returns handler return value if handler returns value in next retries ', async () => {
    API_PULLING.maxRetries = 3;

    expect(await pullHandler(handler)).toStrictEqual(42);
    expect(setTimeout).toHaveBeenCalledTimes(2);
  });

  it(`returns undefined if handler failed all retries`, async () => {
    API_PULLING.maxRetries = 1;

    expect(await pullHandler(handler)).toStrictEqual(undefined);
    expect(setTimeout).toHaveBeenCalledTimes(1);
  });
});
