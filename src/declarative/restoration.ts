/** Roll back only mutations whose last written value is still ours. */
export class OwnedMutations {
  private readonly changes = new Map<HTMLElement, Map<string, {
    before: string | null; owned: string | null;
    read: () => string | null; write: (value: string | null) => void;
  }>>();

  private set(el: HTMLElement, key: string, value: string | null,
    read: () => string | null, write: (value: string | null) => void): void {
    let entries = this.changes.get(el);
    if (!entries) this.changes.set(el, entries = new Map());
    let change = entries.get(key);
    if (!change) {
      change = { before: read(), owned: value, read, write };
      entries.set(key, change);
    }
    change.owned = value;
    write(value);
  }

  attribute(el: HTMLElement, name: string, value: string | null): void {
    this.set(el, `attr:${name}`, value, () => el.getAttribute(name), next => {
      if (next === null) el.removeAttribute(name);
      else el.setAttribute(name, next);
    });
  }

  classToken(el: HTMLElement, token: string, present: boolean): void {
    const hadAttribute = el.hasAttribute('class');
    this.set(el, `class:${token}`, present ? 'yes' : null,
      () => el.classList.contains(token) ? 'yes' : null,
      next => {
        el.classList.toggle(token, next !== null);
        if (!hadAttribute && el.getAttribute('class') === '') el.removeAttribute('class');
      });
  }

  display(el: HTMLElement, value: string): void {
    const hadAttribute = el.hasAttribute('style');
    this.set(el, 'style:display', JSON.stringify([value, '']),
      () => JSON.stringify([el.style.getPropertyValue('display'), el.style.getPropertyPriority('display')]),
      next => {
        const [display, priority] = JSON.parse(next!);
        if (display) el.style.setProperty('display', display, priority);
        else el.style.removeProperty('display');
        if (!hadAttribute && el.getAttribute('style') === '') el.removeAttribute('style');
      });
  }

  restore(): void {
    for (const entries of this.changes.values()) {
      for (const change of entries.values()) {
        if (change.read() === change.owned) change.write(change.before);
      }
    }
    this.changes.clear();
  }
}
