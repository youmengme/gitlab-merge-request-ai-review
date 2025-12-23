import { createInterface } from 'readline';
import { createReadStream } from 'fs';

const readSingleLineFromFile = (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const inputStream = createReadStream(filePath);
    const lineReader = createInterface({
      input: inputStream,
      crlfDelay: Infinity,
    });

    inputStream.on('error', err => {
      reject(new Error(`Error reading file: ${err.message}`));
    });

    lineReader.once('line', line => {
      lineReader.close();
      resolve(line);
    });

    lineReader.on('error', err => {
      reject(new Error(`Error reading file: ${err.message}`));
    });
  });

const setEnvVariableFromFile = async (
  variable: string,
  file: string,
  reader: (filePath: string) => Promise<string>,
) => {
  const value = await reader(file);
  process.env[variable] = value;
};

export { readSingleLineFromFile, setEnvVariableFromFile };
