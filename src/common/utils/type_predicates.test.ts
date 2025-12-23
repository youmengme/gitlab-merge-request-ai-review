import { isArrayOfString, isRecordOfStringBoolean } from './type_predicates';

describe('isArrayOfString', () => {
  it.each`
    value        | expectedResult
    ${undefined} | ${false}
    ${{}}        | ${false}
    ${[1]}       | ${false}
    ${['1', 1]}  | ${false}
    ${[]}        | ${true}
    ${['foo']}   | ${true}
  `('returns $expectedResult for $value', ({ value, expectedResult }) => {
    expect(isArrayOfString(value)).toBe(expectedResult);
  });
});

describe('isRecordOfStringBoolean', () => {
  it.each`
    value             | expectedResult
    ${undefined}      | ${false}
    ${[]}             | ${false}
    ${[true]}         | ${false}
    ${{ foo: 'bar' }} | ${false}
    ${{}}             | ${true}
    ${{ foo: true }}  | ${true}
  `('returns $expectedResult for $value', ({ value, expectedResult }) => {
    expect(isRecordOfStringBoolean(value)).toBe(expectedResult);
  });
});
