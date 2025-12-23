import { v4 as uuidv4 } from 'uuid';

export const generateSecret = (): string => {
  let secret = '';
  const length = Math.floor(Math.random() * 11) + 50; // Randomly choose any number between 50 and 60 inclusive

  while (secret.length < length) {
    secret += uuidv4().replace(/-/g, '');
  }

  return secret.substr(0, length);
};
