import { EventEmitter, diffEmitter } from './diff_emitter';

describe('diffEmitter', () => {
  let fakeEmitter: EventEmitter<string | number>;
  let testDiffEmitter: EventEmitter<string | number | object>;
  beforeEach(() => {
    fakeEmitter = {
      event: jest.fn(),
      fire: jest.fn(),
      dispose: jest.fn(),
    };

    testDiffEmitter = diffEmitter(fakeEmitter);
  });

  it('exposes event and dispose from the original emitter', () => {
    const listener = jest.fn();
    testDiffEmitter.event(listener);
    expect(fakeEmitter.event).toHaveBeenCalledWith(listener);
    testDiffEmitter.dispose();
    expect(fakeEmitter.dispose).toHaveBeenCalled();
  });

  it('fires when the data is different', () => {
    testDiffEmitter.fire('a');

    expect(fakeEmitter.fire).toHaveBeenCalledWith('a');
    jest.mocked(fakeEmitter.fire).mockClear();

    testDiffEmitter.fire('b');

    expect(fakeEmitter.fire).toHaveBeenCalledWith('b');
  });

  it('does not fire if the data is the same', () => {
    testDiffEmitter.fire('a');

    expect(fakeEmitter.fire).toHaveBeenCalledWith('a');
    jest.mocked(fakeEmitter.fire).mockClear();

    testDiffEmitter.fire('a');

    expect(fakeEmitter.fire).not.toHaveBeenCalled();
  });

  it('uses provided equalFn to check data equality', () => {
    // eslint-disable-next-line eqeqeq
    testDiffEmitter = diffEmitter(fakeEmitter, (a, b) => a == b);

    testDiffEmitter.fire(1);

    expect(fakeEmitter.fire).toHaveBeenCalled();
    jest.mocked(fakeEmitter.fire).mockClear();

    testDiffEmitter.fire('1'); // we use double equal so '1' coalesces to 1

    expect(fakeEmitter.fire).not.toHaveBeenCalled();
  });

  it('should emit even when updated reference was not changed', () => {
    const updatedObject = { a: 1, b: 2 };
    testDiffEmitter.fire(updatedObject);

    expect(fakeEmitter.fire).toHaveBeenCalledWith(updatedObject);
    jest.mocked(fakeEmitter.fire).mockClear();

    updatedObject.a = 3;
    testDiffEmitter.fire(updatedObject);

    expect(fakeEmitter.fire).toHaveBeenCalledWith(updatedObject);
  });
});
