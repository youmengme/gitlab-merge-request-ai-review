import { Position } from './position';

describe('Position', () => {
  describe('isEqual', () => {
    it.each`
      a                     | b                     | equals
      ${new Position(1, 1)} | ${new Position(1, 1)} | ${true}
      ${new Position(1, 1)} | ${new Position(1, 2)} | ${false}
      ${new Position(1, 1)} | ${new Position(2, 1)} | ${false}
      ${new Position(1, 2)} | ${new Position(1, 1)} | ${false}
      ${new Position(2, 1)} | ${new Position(1, 1)} | ${false}
    `(
      'position $positionA and position $positionB equals = $equals',
      ({ a, b, equals }: { a: Position; b: Position; equals: boolean }) => {
        expect(a.isEqual(b)).toBe(equals);
      },
    );
  });

  describe('isBefore', () => {
    it.each`
      a                     | b                     | equals
      ${new Position(1, 1)} | ${new Position(1, 2)} | ${true}
      ${new Position(1, 1)} | ${new Position(2, 1)} | ${true}
      ${new Position(1, 1)} | ${new Position(1, 1)} | ${false}
      ${new Position(1, 2)} | ${new Position(1, 1)} | ${false}
      ${new Position(2, 1)} | ${new Position(1, 1)} | ${false}
    `(
      'position $positionA and position $positionB equals = $equals',
      ({ a, b, equals }: { a: Position; b: Position; equals: boolean }) => {
        expect(a.isBefore(b)).toBe(equals);
      },
    );
  });

  describe('compareTo', () => {
    it.each`
      a                     | b                     | result
      ${new Position(1, 1)} | ${new Position(1, 1)} | ${0}
      ${new Position(1, 1)} | ${new Position(1, 2)} | ${-1}
      ${new Position(1, 2)} | ${new Position(1, 1)} | ${1}
      ${new Position(1, 1)} | ${new Position(2, 1)} | ${-1}
      ${new Position(2, 1)} | ${new Position(1, 1)} | ${1}
      ${new Position(2, 3)} | ${new Position(3, 1)} | ${-1}
      ${new Position(3, 1)} | ${new Position(2, 5)} | ${1}
    `(
      'comparing position ($a.line,$a.character) to ($b.line,$b.character) results in $result',
      ({ a, b, result }: { a: Position; b: Position; result: number }) => {
        expect(Math.sign(a.compareTo(b))).toBe(result);
      },
    );
  });
});
