import { segmentWidth } from './geometry';

/** Contact spans the flap's width plus the peg, measured around the wheel's rim. */
const CONTACT_HALF_ANGLE = 0.055;
const MAX_DEFLECTION = 0.38;
const RETURN_RATE = 35;

/**
 * Push the flap while the nearest peg is touching it, including the approach before crossing
 * the top. After release, spring home on the same frame clock as the wheel.
 */
export function pointerRotation(
  from: number,
  rotation: number,
  count: number,
  previous: number,
  seconds: number,
): number {
  const width = segmentWidth(count);
  const phase = ((((rotation + width / 2) % width) + width) % width) - width / 2;
  if (Math.abs(phase) <= CONTACT_HALF_ANGLE) {
    const contact = (phase + CONTACT_HALF_ANGLE) / (2 * CONTACT_HALF_ANGLE);
    return -MAX_DEFLECTION * contact;
  }
  // If a busy frame skipped the contact window, still release from the last peg in that
  // frame. Estimate its release time from the same rotation interval used to draw the wheel.
  const release = Math.floor((rotation - CONTACT_HALF_ANGLE) / width) * width + CONTACT_HALF_ANGLE;
  const crossedRelease = rotation > from && release >= from;
  const returnSeconds = crossedRelease
    ? (seconds * (rotation - release)) / (rotation - from)
    : seconds;
  const returned =
    (crossedRelease ? -MAX_DEFLECTION : previous) * Math.exp(-RETURN_RATE * returnSeconds);
  return Math.abs(returned) < 1e-4 ? 0 : returned;
}
