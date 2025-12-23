import { join } from 'path';
import { Repository } from '../api/git';

// even on Windows, the git show command accepts only POSIX paths
const getAbsolutePath = (rawRepository: Repository, path: string) =>
  join(rawRepository.rootUri.fsPath, path).replace(/\\/g, '/');

export const getFileContent = (
  rawRepository: Repository,
  path: string,
  sha: string,
): Promise<Buffer | null> => {
  const absolutePath = getAbsolutePath(rawRepository, path);
  // null sufficiently signalises that the file has not been found
  // this scenario is going to happen often (for open and squashed MRs)
  return rawRepository.buffer(sha, absolutePath).catch(() => null);
};

export const getFileSize = async (
  rawRepository: Repository,
  path: string,
  sha: string,
): Promise<number | null> => {
  const absolutePath = getAbsolutePath(rawRepository, path);
  try {
    const details = await rawRepository.getObjectDetails(sha, absolutePath);
    return details.size;
  } catch {
    // null sufficiently signalises that the file has not been found
    // this scenario is going to happen often (for open and squashed MRs)
    return null;
  }
};
