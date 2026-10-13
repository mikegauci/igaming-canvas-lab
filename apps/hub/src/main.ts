import { fail, finish, progress } from './loader';

/**
 * The hub is the Pixi Casino Floor, behind a boot screen while it loads. A plain list of the games
 * is kept in the page (visually hidden) for search engines, link previews and screen readers.
 */
const stage = document.getElementById('stage')!;
const contact = document.getElementById('contact') as HTMLDialogElement;

const openContact = () => contact.showModal();

document.getElementById('contact-open')?.addEventListener('click', openContact);
contact.querySelector('[data-close]')?.addEventListener('click', () => contact.close());

// Milestones: the floor's code (Pixi is most of it), then Pixi and the fonts, then the scene.
progress(60, 6);
import('./floor/start')
  .then(({ startFloor }) => {
    progress(85, 3);
    return startFloor(stage, openContact, () => progress(95, 2));
  })
  .then(async (floor) => {
    await finish();
    floor.startIntro();
  })
  .catch(fail);
