import type { FloorHandle } from './floor/start';

/**
 * Two ways in: the arcade (the Pixi Casino Floor) and a plain classic list that is always in the
 * page for search engines, link previews and screen readers. Reduced-motion users get the classic
 * view by default; the choice is remembered.
 */
type View = 'arcade' | 'classic';

const VIEW_KEY = 'lab:hub-view';
const stage = document.getElementById('stage')!;
const toggle = document.getElementById('view-toggle') as HTMLButtonElement;
const contact = document.getElementById('contact') as HTMLDialogElement;

const savedView = (): View | null => {
  try {
    const value = localStorage.getItem(VIEW_KEY);
    return value === 'arcade' || value === 'classic' ? value : null;
  } catch {
    return null;
  }
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const requested = new URLSearchParams(window.location.search).get('view');
let view: View =
  requested === 'classic' || requested === 'arcade'
    ? requested
    : (savedView() ?? (reducedMotion ? 'classic' : 'arcade'));

let floor: Promise<FloorHandle> | null = null;

const openContact = () => contact.showModal();

async function apply(next: View) {
  view = next;
  document.body.classList.toggle('arcade', view === 'arcade');
  toggle.textContent = view === 'arcade' ? 'Classic view' : 'Arcade view';
  toggle.setAttribute('aria-pressed', String(view === 'classic'));
  if (view === 'arcade') {
    // Pixi and the floor are only downloaded when the arcade is actually shown.
    floor ??= import('./floor/start').then(({ startFloor }) => startFloor(stage, openContact));
    (await floor).resume();
  } else if (floor) {
    (await floor).pause();
  }
}

toggle.addEventListener('click', () => {
  const next: View = view === 'arcade' ? 'classic' : 'arcade';
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {
    // Not remembering the choice is fine.
  }
  void apply(next);
});
document.getElementById('contact-open')?.addEventListener('click', openContact);
contact.querySelector('[data-close]')?.addEventListener('click', () => contact.close());

void apply(view);
