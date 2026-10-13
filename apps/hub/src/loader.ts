/**
 * The boot screen shown while Pixi and the floor download. It's plain HTML and CSS (Pixi is what
 * it's waiting for), so it paints with the first frame of the page.
 *
 * Progress follows real milestones. Between them, a long ease-out transition creeps toward the
 * next one, so the bar never sits still on a slow connection and never claims to be done early.
 */
const loader = document.getElementById('loader')!;
const status = loader.querySelector<HTMLElement>('.loader-text')!;

/** How long the switch-off animation runs; also the fallback if animationend never fires. */
const SWITCH_OFF_MS = 450;

/** Moves the bar toward `percent` over `seconds`, fast at first and slowing as it gets close. */
export function progress(percent: number, seconds: number): void {
  loader.style.setProperty('--creep', `${seconds}s`);
  loader.style.setProperty('--p', String(percent));
  loader.setAttribute('aria-valuenow', String(percent));
}

/** Fills the bar, then switches the screen off like an old CRT and removes it. */
export async function finish(): Promise<void> {
  progress(100, 0.25);
  await wait(300);
  loader.classList.add('off');
  await new Promise<void>((resolve) => {
    loader.addEventListener('animationend', () => resolve(), { once: true });
    // Hidden tabs and reduced motion may never fire animationend.
    setTimeout(resolve, SWITCH_OFF_MS + 100);
  });
  loader.remove();
}

/** Shows a failed load and turns the screen into a retry button. */
export function fail(): void {
  loader.classList.add('failed');
  status.textContent = 'LOAD ERROR · TAP TO RETRY';
  loader.setAttribute('aria-label', 'The Casino Floor failed to load. Activate to retry.');
  loader.addEventListener('click', () => window.location.reload(), { once: true });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
