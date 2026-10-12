/**
 * Wheel angles, in radians. The pointer sits at the top. Wheel rotation grows clockwise (as in
 * Pixi), and segment i covers local angles [i·w, (i+1)·w) measured clockwise from the top,
 * where w = 2π / count.
 */
const TAU = Math.PI * 2;

const mod = (n: number, m: number) => ((n % m) + m) % m;

export const segmentWidth = (count: number): number => TAU / count;

/** Local angle of a segment's centre, clockwise from the top. */
export const segmentCenter = (index: number, count: number): number =>
  (index + 0.5) * segmentWidth(count);

/** Which segment is under the pointer when the wheel is at `rotation`. */
export function segmentAtRotation(rotation: number, count: number): number {
  return Math.floor(mod(-rotation, TAU) / segmentWidth(count)) % count;
}

/**
 * Rotation at least `minTravel` past `from` that puts the pointer on segment `index`, `offset`
 * segment-widths from its centre. The wheel only ever turns forwards.
 */
export function targetRotation(
  from: number,
  index: number,
  offset: number,
  count: number,
  minTravel: number,
): number {
  const angle = segmentCenter(index, count) + offset * segmentWidth(count);
  const base = mod(-angle - from, TAU);
  const turns = Math.max(0, Math.ceil((minTravel - base) / TAU));
  return from + base + turns * TAU;
}

/** Pegs (segment edges) that pass the pointer while turning forwards from `from` to `to`. */
export function pegsPassed(from: number, to: number, count: number): number {
  const width = segmentWidth(count);
  return Math.max(0, Math.floor(to / width) - Math.floor(from / width));
}
