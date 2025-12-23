import { PayloadBuilder } from '@snowplow/tracker-core';

export type SendEventCallback = (events: PayloadBuilder[]) => Promise<void>;

enum EmitterState {
  STARTED,
  STOPPING,
  STOPPED,
}

export class Emitter {
  #trackingQueue: PayloadBuilder[] = [];

  #callback: SendEventCallback;

  #timeInterval: number;

  #maxItems: number;

  #currentState: EmitterState;

  #timeout: NodeJS.Timeout | undefined;

  constructor(timeInterval: number, maxItems: number, callback: SendEventCallback) {
    this.#maxItems = maxItems;
    this.#timeInterval = timeInterval;
    this.#callback = callback;
    this.#currentState = EmitterState.STOPPED;
  }

  add(data: PayloadBuilder) {
    this.#trackingQueue.push(data);

    if (this.#trackingQueue.length >= this.#maxItems) {
      this.#drainQueue().catch(() => {});
    }
  }

  async #drainQueue(): Promise<void> {
    if (this.#trackingQueue.length > 0) {
      const copyOfTrackingQueue = this.#trackingQueue.map(e => e);
      this.#trackingQueue = [];
      await this.#callback(copyOfTrackingQueue);
    }
  }

  start() {
    this.#timeout = setTimeout(async () => {
      await this.#drainQueue();

      if (this.#currentState !== EmitterState.STOPPING) {
        this.start();
      }
    }, this.#timeInterval);
    this.#currentState = EmitterState.STARTED;
  }

  async stop() {
    this.#currentState = EmitterState.STOPPING;
    if (this.#timeout) {
      clearTimeout(this.#timeout);
    }
    this.#timeout = undefined;
    await this.#drainQueue();
  }
}
