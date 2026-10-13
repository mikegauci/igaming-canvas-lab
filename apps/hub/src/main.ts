import { fail, finish, progress } from './loader';

/**
 * The hub is the Pixi Casino Floor, behind a boot screen while it loads. A plain list of the games
 * is kept in the page (visually hidden) for search engines, link previews and screen readers.
 */
const stage = document.getElementById('stage')!;
const contact = document.getElementById('contact') as HTMLDialogElement;

document.getElementById('contact-open')?.addEventListener('click', () => contact.showModal());
contact.querySelector('[data-close]')?.addEventListener('click', () => contact.close());

// Milestones: the floor's code (Pixi is most of it), then Pixi, the fonts and the cabinet art,
// then the scene.
progress(60, 6);
import('./floor/start')
  .then(({ startFloor }) => {
    progress(85, 3);
    return startFloor(stage, (done) => progress(Math.round(85 + done * 10), 2));
  })
  .then(async (floor) => {
    await finish();
    floor.startIntro();
  })
  .catch(fail);
