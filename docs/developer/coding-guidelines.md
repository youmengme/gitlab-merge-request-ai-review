---
stage: AI-powered
group: Editor Extensions
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# Coding guidelines

We rely on `eslint` and `prettier` for code style. These guidelines contain a few rules that `eslint` and `prettier` tools don't enforce.

## TypeScript

- Prefer `interface` over `type` declaration when describing structures. For more information, read the discussion on the [merge request that introduced TypeScript](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/108#note_423512996).
- Use `type` to define aliases for existing types, classes or interfaces, or to derive a type from another type.
  For example, `type PartialConfig = Partial<Config>`.

## Desktop/Common/Browser

When implementing a feature, decide which environments will support the feature. If the feature is useful in both Desktop and WebIDE, place the feature to `common` folder. See [Architecture](architecture.md) docs for more details.

### Utils (`src/<desktop|common>utils`)

We try to minimize the code we put in utils. There needs to be a good justification to take a function out of its context and put it into utils. This justification is usually that it's used in many other modules.

Each file in `utils` folder must contain only one function. The file name uses snake_case, the function name uses camelCase.

Example:

| file                                                                     | function            | purpose                                                                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`compare_by.ts`](../../src/common/utils/compare_by.ts)                  | `compareBy()`       | Creates a comparison method for objects that can be used for sorting.                                                                                                             |
| [`find_file_in_diffs.ts`](../../src/desktop/utils/find_file_in_diffs.ts) | `findFileInDiffs()` | Iterates through the GitLab API MR diff (versions) response, and finds the diff for a file based on a path. Used multiple places responsible for rendering merge request reviews. |
