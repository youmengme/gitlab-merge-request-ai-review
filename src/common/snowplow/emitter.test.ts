import { payloadBuilder } from '@snowplow/tracker-core';
import { Emitter } from './emitter';

const pb = payloadBuilder();

describe('Emitter', () => {
  describe('Tracking Queue interface', () => {
    it('should initialize', () => {
      const queue = new Emitter(1000, 10, async () => {});
      expect(queue).not.toBeUndefined();
    });

    it('should add an event to the queue', async () => {
      const queue = new Emitter(1000, 10, async () => {});
      await queue.add(pb);
    });

    it('should have a start and stop method', async () => {
      const queue = new Emitter(1000, 10, async () => {});
      queue.start();
      await queue.stop();
    });
  });

  describe('Drain queue', () => {
    it('should drain when the max items is reached', async () => {
      const callback = jest.fn();
      const queue = new Emitter(1000, 1, callback);
      queue.start();
      await queue.add(pb);
      expect(callback).toBeCalledWith([pb]);
      await queue.stop();
    });

    it('should drain when the time is reached', async () => {
      const callback = jest.fn();
      const queue = new Emitter(500, 10, callback);
      queue.start();
      await queue.add(pb);
      await new Promise(r => {
        setTimeout(r, 500);
      });
      expect(callback).toBeCalledWith([pb]);
      await queue.stop();
    });

    it('should not drain when the time has not been reached', async () => {
      const callback = jest.fn();
      const queue = new Emitter(2000, 10, callback);
      queue.start();
      await queue.add(pb);
      await new Promise(r => {
        setTimeout(r, 100);
      });
      expect(callback).not.toBeCalled();
      await queue.stop();
    });

    it('should drain when the queue is stopped', async () => {
      const callback = jest.fn();
      const queue = new Emitter(2000, 10, callback);
      queue.start();
      await queue.add(pb);
      await new Promise(r => {
        setTimeout(r, 100);
      });
      await queue.stop();
      expect(callback).toBeCalledWith([pb]);
    });

    it('should drain multiple items', async () => {
      const callback = jest.fn();
      const queue = new Emitter(100, 10, callback);
      queue.start();
      const pb1 = payloadBuilder();
      await queue.add(pb);
      await queue.add(pb1);
      await queue.stop();
      expect(callback).toBeCalledWith([pb, pb1]);
    });
  });
});
