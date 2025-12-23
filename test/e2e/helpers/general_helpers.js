import { browser } from '@wdio/globals';
import { v4 as uuidv4 } from 'uuid';
import logger from '@wdio/logger';

const log = logger('webdriver');

/**
 * Generates a random alphanumeric string from 1 to 32 characters long
 *
 * @param {string|number} length - The length of the random string
 * @returns {String}
 */
const generateRandomString = length => {
  const uuid = uuidv4();
  const randomString = uuid.replace(/-/g, '');

  return randomString.slice(0, Number(length));
};

/**
 * Executes a promise with temporarily set error log level and restores original level afterward
 * This can be useful when handling sensitive data so it is not released in the wdio logs.
 *
 * @param {Function} promise - Async function to be executed with error logging
 * @returns {Promise<any>} Result of the executed promise
 * @throws {Error} Throws any error from the executed promise while maintaining error logging
 */
const withLoggerAtError = async promise => {
  const ERROR_LOG_LEVEL = 'error';
  const originalLogLevel = browser.options.logLevel ?? ERROR_LOG_LEVEL;

  try {
    log.setLevel(ERROR_LOG_LEVEL);
    return await promise();
  } finally {
    log.setLevel(originalLogLevel);
  }
};

export { generateRandomString, withLoggerAtError };
