import { Position } from './position';

export class Selection {
  readonly anchor: Position;

  readonly active: Position;

  readonly start: Position;

  readonly end: Position;

  constructor(
    anchorLine: number | Position,
    anchorCharacter: number | Position,
    activeLine?: number,
    activeCharacter?: number,
  ) {
    let anchor: Position;
    let active: Position;

    if (
      anchorLine instanceof Position &&
      anchorCharacter instanceof Position &&
      activeLine === undefined &&
      activeCharacter === undefined
    ) {
      anchor = anchorLine;
      active = anchorCharacter;
    } else {
      anchor = new Position(anchorLine as number, anchorCharacter as number);
      active = new Position(activeLine as number, activeCharacter as number);
    }

    this.anchor = anchor;
    this.active = active;
    this.start = anchor.isBefore(active) ? anchor : active;
    this.end = anchor.isBefore(active) ? active : anchor;
  }

  get isEmpty() {
    return this.start.isEqual(this.end);
  }
}
