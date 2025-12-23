import {
  Payload,
  PayloadBuilder,
  SelfDescribingJson,
  StructuredEvent,
  buildStructEvent,
  trackerCore,
  TrackerCore,
} from '@snowplow/tracker-core';
import fetch from 'cross-fetch';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../log';
import { Emitter } from './emitter';
import { SnowplowOptions } from './snowplow_options';

/**
 * Adds the 'stm' paramater with the current time to the payload
 * Stringyfiy all payload values
 * @param payload - The payload which will be mutated
 */
function preparePayload(payload: Payload): Record<string, string> {
  const stringifiedPayload: Record<string, string> = {};

  Object.keys(payload).forEach(key => {
    stringifiedPayload[key] = String(payload[key]);
  });

  stringifiedPayload.stm = new Date().getTime().toString();

  return stringifiedPayload;
}

export class Snowplow {
  #emitter: Emitter;

  #options: SnowplowOptions;

  #tracker: TrackerCore;

  #ideExtensionContext: SelfDescribingJson;

  // eslint-disable-next-line no-use-before-define
  static #instance: Snowplow;

  // constructors can't be made private with #
  // eslint-disable-next-line no-restricted-syntax
  private constructor(options: SnowplowOptions) {
    this.#options = options;
    this.#ideExtensionContext = options.ideExtensionContext;
    this.#emitter = new Emitter(
      this.#options.timeInterval,
      this.#options.maxItems,
      this.#sendEvent.bind(this),
    );
    this.#emitter.start();
    this.#tracker = trackerCore({ callback: this.#emitter.add.bind(this.#emitter) });
  }

  static getInstance(options?: SnowplowOptions): Snowplow {
    if (!this.#instance) {
      if (!options) {
        throw new Error('Snowplow should be instantiated');
      }
      const sp = new Snowplow(options);
      Snowplow.#instance = sp;
    }

    return Snowplow.#instance;
  }

  async #sendEvent(events: PayloadBuilder[]): Promise<void> {
    if (!this.#options.enabled()) {
      return;
    }

    const url = `${this.#options.endpoint}/com.snowplowanalytics.snowplow/tp2`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schema: 'iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4',
        data: events.map(event => {
          const eventId = uuidv4();
          // All values prefieled below are part of snowplow tracker protocol
          // https://docs.snowplow.io/docs/collecting-data/collecting-from-own-applications/snowplow-tracker-protocol/#common-parameters
          // Values are set according to either common GitLab standard:
          // tna - representing tracker namespace and being set across GitLab to "gl"
          // tv - represents tracker value, to make it aligned with downstream system it has to be prefixed with "js-*""
          // aid - represents app Id is configured via options to gitlab_ide_extension
          // eid - represents uuid for each emitted event
          event.add('eid', eventId);
          event.add('p', 'app');
          event.add('tv', 'js-gitlab');
          event.add('tna', 'gl');
          event.add('aid', this.#options.appId);

          return preparePayload(event.build());
        }),
      }),
    });

    if (response.status !== 200) {
      log.warn(`Could not send telmetry to snowplow status=${response.status}`);
    }
  }

  async trackStructEvent(
    event: StructuredEvent,
    contextArg?: (SelfDescribingJson | 'ide-extension-context')[] | null,
  ): Promise<void> {
    const context =
      contextArg &&
      contextArg.map(x => {
        if (x === 'ide-extension-context') {
          return this.#ideExtensionContext;
        }
        return x;
      });
    this.#tracker.track(buildStructEvent(event), context);
  }

  async stop() {
    await this.#emitter.stop();
  }
}
