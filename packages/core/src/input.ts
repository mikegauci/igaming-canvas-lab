const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Space/Enter on a focused button or link already clicks it; handling it too would fire twice. */
const activatesFocused = (event: KeyboardEvent) =>
  (event.code === 'Space' || event.code === 'Enter') &&
  event.target instanceof HTMLElement &&
  ['BUTTON', 'A'].includes(event.target.tagName);

/**
 * Calls `handler` when one of the `KeyboardEvent.code`s is pressed (e.g. 'Space', 'ArrowUp').
 * Ignores key repeat and typing in form fields. Returns an unsubscribe function.
 */
export function onKey(codes: string | readonly string[], handler: (event: KeyboardEvent) => void) {
  const list = typeof codes === 'string' ? [codes] : codes;
  const listener = (event: KeyboardEvent) => {
    if (event.repeat || !list.includes(event.code)) return;
    if (isTyping(event.target) || activatesFocused(event)) return;
    event.preventDefault(); // stops Space from scrolling the page
    handler(event);
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}
