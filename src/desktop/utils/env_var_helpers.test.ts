import fs from 'fs';
import readline from 'readline';
import { Readable } from 'stream';
import { readSingleLineFromFile, setEnvVariableFromFile } from './env_var_helpers';

describe('Using setEnvVariableFromFile to set an env variable by using readSingleLineFromFile', () => {
  class MockStream extends Readable {
    lines: string[];

    constructor(lines: string[]) {
      super();
      this.lines = lines;
    }

    // eslint-disable-next-line no-underscore-dangle
    _read() {
      if (this.lines.length === 0) {
        this.push(null);
      } else {
        this.push(`${this.lines.shift()}\n`);
      }
    }

    close() {}

    bytesRead: number = 0;

    path: string = '';

    pending: boolean = false;
  }

  beforeEach(() => {
    process.env.FILE_PATH = 'filePath';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.FILE_PATH;
    delete process.env.ENV_VARIABLE;
  });

  const func = () => setEnvVariableFromFile('ENV_VARIABLE', 'FILE_PATH', readSingleLineFromFile);

  describe('when we can succssefully read the file', () => {
    it('updates the env variable', async () => {
      const inputStream = new MockStream(['FIRST-LINE']);
      jest.spyOn(fs, 'createReadStream').mockReturnValue(inputStream);
      await func();
      expect(process.env.ENV_VARIABLE).toBe('FIRST-LINE');
    });
  });

  describe('when we cannot create the inTerface', () => {
    it('does not update the env variable and throws an error', async () => {
      const inputStream = new MockStream(['']);
      jest.spyOn(fs, 'createReadStream').mockReturnValue(inputStream);
      jest.spyOn(readline, 'createInterface').mockImplementation(() => {
        throw new Error('cannot create interface');
      });

      await expect(func()).rejects.toThrow(new Error('cannot create interface'));
      expect(process.env.ENV_VARIABLE).toBe(undefined);
    });
  });

  describe('when we cannot create the file stream', () => {
    it('does not update the env variable and throws an error', async () => {
      jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
        throw new Error('cannot create the file stream');
      });
      await expect(func()).rejects.toThrow(new Error('cannot create the file stream'));
      expect(process.env.ENV_VARIABLE).toBe(undefined);
    });
  });

  describe('when reading a line fails', () => {
    it('does not update the env variable and throws an error', async () => {
      const inputStream = new MockStream(['']);
      jest.spyOn(fs, 'createReadStream').mockReturnValue(inputStream);
      jest.spyOn(inputStream, '_read').mockImplementation(() => {
        throw new Error('cannot read line');
      });
      await expect(func()).rejects.toThrow(new Error('Error reading file: cannot read line'));
      expect(process.env.ENV_VARIABLE).toBe(undefined);
    });
  });
});
