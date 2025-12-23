import { diffFile } from '../../test_utils/entities';
import { findDiffWithPath } from './find_diff_with_path';

describe('findDiffWithPath', () => {
  it('finds diff for for old path', () => {
    expect(findDiffWithPath([diffFile], 'old_file.js')).toEqual(diffFile);
  });

  it('finds diff for for new path', () => {
    expect(findDiffWithPath([diffFile], 'new_file.js')).toEqual(diffFile);
  });

  it('returns undefined if there is no matching diff', () => {
    expect(findDiffWithPath([diffFile], 'does_not_exist')).toBe(undefined);
  });
});
