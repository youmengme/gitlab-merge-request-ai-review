import { waitForMs } from './wait_for_ms';

describe('common/utils/wait_for_ms', () => {
  it('resolves after ms has passed', async () => {
    jest.useFakeTimers();

    const result = waitForMs(100);

    jest.advanceTimersByTime(100);
    await expect(result).resolves.toBeUndefined();
  });
});
