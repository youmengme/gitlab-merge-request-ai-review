import { isInlineCompletionList } from './code_suggestions';

describe('isInlineCompletionList', () => {
  it.each`
    list                    | objectType                     | result
    ${undefined}            | ${'undefined'}                 | ${false}
    ${null}                 | ${'null'}                      | ${false}
    ${''}                   | ${'empty string'}              | ${false}
    ${{ items: [] }}        | ${'empty completion list'}     | ${true}
    ${{ items: [1, 2, 3] }} | ${'not empty completion list'} | ${true}
  `('returns "$result" when object is $objectType', ({ list, result }) => {
    expect(isInlineCompletionList(list)).toBe(result);
  });
});
