import { Repository } from '../api/git';

export const newRemoteName = (repository: Repository) => {
  const { remotes } = repository.state;
  if (!remotes.find(r => r.name === 'origin')) {
    return 'origin';
  }

  let i = 2;

  /* This function is not used after `find` returns, so this is safe. */
  // eslint-disable-next-line no-loop-func
  while (remotes.find(r => r.name === `origin${i}`)) {
    i++;
  }
  return `origin${i}`;
};
