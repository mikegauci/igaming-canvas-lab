export interface WheelEaseOptions {
  /** How far past the target the wheel drifts before settling back, as a share of the travel. */
  overshoot: number;
  /** Share of the time spent decelerating towards the overshoot peak (the rest settles back). */
  peakAt?: number;
  /** Deceleration curve; higher is a longer, slower crawl at the end. */
  power?: number;
}

export interface WheelEase {
  (t: number): number;
  /** Slope at t = 0, used to match the wheel's speed when the ease takes over. */
  initialSlope: number;
}

/**
 * Deceleration ease for the wheel: a power curve that creeps just past the target, then a gentle
 * cosine settle back onto it. The creep past a peg and back is the "will it, won't it" moment.
 * Continuous in value and speed, so there is no visible jolt.
 */
export function createWheelEase({
  overshoot,
  peakAt = 0.88,
  power = 3,
}: WheelEaseOptions): WheelEase {
  const peak = 1 + overshoot;
  const ease = ((t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    if (t <= peakAt) return peak * (1 - (1 - t / peakAt) ** power);
    const settle = (t - peakAt) / (1 - peakAt);
    return 1 + (overshoot * (1 + Math.cos(Math.PI * settle))) / 2;
  }) as WheelEase;
  ease.initialSlope = (peak * power) / peakAt;
  return ease;
}
