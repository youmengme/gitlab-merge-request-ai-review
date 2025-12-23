export const findDiffWithPath = (
  diffs: RestDiffFile[],
  relativePath: string,
): RestDiffFile | undefined =>
  diffs.find(d => d.new_path === relativePath || d.old_path === relativePath);
