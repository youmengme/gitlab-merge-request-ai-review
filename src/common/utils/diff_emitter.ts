import vscode from 'vscode';
import { isEqual as lodashIsEqual, cloneDeep } from 'lodash';

/** This interface exactly copies the vscode.EventEmitter class */
export interface EventEmitter<T> {
  event: vscode.Event<T>;
  fire(data: T): void;
  dispose(): void;
}

/** promotes EventEmitter into an emitter that will only fire change event if the value T has changed
 * @param emitter the base emitter this function wraps
 * @param equalFn optionally, you can provide a function to compare the event data, if no equalFn is provided, we use lodash isEqual
 */
export const diffEmitter = <T>(
  emitter: EventEmitter<T>,
  equalFn?: (a: T, b: T) => boolean,
): EventEmitter<T> => {
  let previousValue: T;
  const isEqual = equalFn || lodashIsEqual;
  return {
    event: emitter.event.bind(emitter),
    fire: (data: T) => {
      if (!isEqual(previousValue, data)) {
        previousValue = cloneDeep(data);
        emitter.fire(data);
      }
    },
    dispose: emitter.dispose.bind(emitter),
  };
};
