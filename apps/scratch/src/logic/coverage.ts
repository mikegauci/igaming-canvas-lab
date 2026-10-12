export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Tracks how much of the card has been scratched, on a coarse grid in CPU memory. Reading the
 * render texture back from the GPU every frame would stall the pipeline; stamping the same brush
 * strokes into a small grid is cheap and exact enough for "is 60% revealed?".
 */
export class CoverageGrid {
  private readonly cells: Uint8Array;
  private readonly cellWidth: number;
  private readonly cellHeight: number;
  private covered = 0;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly columns: number,
    readonly rows: number,
  ) {
    this.cells = new Uint8Array(columns * rows);
    this.cellWidth = width / columns;
    this.cellHeight = height / rows;
  }

  /** Share of the whole area scratched, 0..1. */
  get coverage(): number {
    return this.covered / this.cells.length;
  }

  /**
   * Marks every cell whose centre is within `radius` of the segment (x0,y0)–(x1,y1), i.e. under a
   * round brush dragged along it. Returns how many cells were newly covered.
   */
  stamp(x0: number, y0: number, x1: number, y1: number, radius: number): number {
    const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - radius) / this.cellWidth));
    const c1 = Math.min(this.columns - 1, Math.floor((Math.max(x0, x1) + radius) / this.cellWidth));
    const r0 = Math.max(0, Math.floor((Math.min(y0, y1) - radius) / this.cellHeight));
    const r1 = Math.min(this.rows - 1, Math.floor((Math.max(y0, y1) + radius) / this.cellHeight));

    let added = 0;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const index = row * this.columns + col;
        if (this.cells[index]) continue;
        const cx = (col + 0.5) * this.cellWidth;
        const cy = (row + 0.5) * this.cellHeight;
        if (distanceToSegmentSquared(cx, cy, x0, y0, x1, y1) <= radius * radius) {
          this.cells[index] = 1;
          added++;
        }
      }
    }
    this.covered += added;
    return added;
  }

  /** Share of the cells whose centres fall inside `rect` that are scratched, 0..1. */
  coverageIn({ x, y, width, height }: Rect): number {
    const c0 = Math.max(0, Math.ceil(x / this.cellWidth - 0.5));
    const c1 = Math.min(this.columns - 1, Math.floor((x + width) / this.cellWidth - 0.5));
    const r0 = Math.max(0, Math.ceil(y / this.cellHeight - 0.5));
    const r1 = Math.min(this.rows - 1, Math.floor((y + height) / this.cellHeight - 0.5));
    let total = 0;
    let hit = 0;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        total++;
        hit += this.cells[row * this.columns + col]!;
      }
    }
    return total === 0 ? 0 : hit / total;
  }

  reset(): void {
    this.cells.fill(0);
    this.covered = 0;
  }
}

function distanceToSegmentSquared(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lengthSquared));
  const ex = x0 + t * dx - px;
  const ey = y0 + t * dy - py;
  return ex * ex + ey * ey;
}
