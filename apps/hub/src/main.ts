/**
 * The hub is the Pixi Casino Floor. A plain list of the games is kept in the page (visually
 * hidden) for search engines, link previews and screen readers.
 */
const stage = document.getElementById('stage')!;
const contact = document.getElementById('contact') as HTMLDialogElement;

const openContact = () => contact.showModal();

document.getElementById('contact-open')?.addEventListener('click', openContact);
contact.querySelector('[data-close]')?.addEventListener('click', () => contact.close());

void import('./floor/start').then(({ startFloor }) => startFloor(stage, openContact));
