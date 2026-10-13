export interface WheelEaseOptions {
  /** Deceleration curve; higher is a longer, slower crawl at the end. */
  power?: number;
}

export interface WheelEase {
  (t: number): number;
  /** Slope at t = 0, used to match the wheel's speed when the ease takes over. */
  initialSlope: number;
  /** Exact slope, used to keep the speed continuous when STOP replans the landing. */
  slope(t: number): number;
}

/** Forward-only deceleration that reaches the target at zero speed without crossing it. */
export function createWheelEase({ power = 3 }: WheelEaseOptions = {}): WheelEase {
  const ease = ((t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 1 - (1 - t) ** power;
  }) as WheelEase;
  ease.initialSlope = power;
  ease.slope = (t) => power * (1 - Math.max(0, Math.min(1, t))) ** (power - 1);
  return ease;
}
