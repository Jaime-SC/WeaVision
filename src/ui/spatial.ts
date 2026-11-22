// D-pad spatial navigation for Android TV remotes (also works with keyboard arrows).
type Dir = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select, [tabindex="0"]';

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}

/** The innermost open layer (dialog, player) traps focus; otherwise the whole document. */
export function scope(): ParentNode {
  const layers = [...document.querySelectorAll<HTMLElement>("[data-layer]:not([hidden])")];
  return layers.at(-1) ?? document;
}

/** Text fields open the on-screen keyboard when focused, so they are never focused on their own. */
const isText = (el: Element) => el.matches("input:not([type=range]):not([type=file]), textarea");

export function focusFirst(root: ParentNode = scope()): void {
  const el = [...root.querySelectorAll<HTMLElement>("[data-autofocus]"), ...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find((e) => visible(e) && !isText(e));
  el?.focus({ preventScroll: false });
}

export function move(dir: Dir): boolean {
  const cur = document.activeElement as HTMLElement | null;
  const root = scope();
  if (!cur || cur === document.body || !root.contains(cur)) {
    focusFirst(root);
    return true;
  }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (el === cur || !visible(el)) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    // Must lie beyond the current element's edge in the pressed direction.
    const ok =
      dir === "ArrowRight" ? b.left >= a.right - 4 :
      dir === "ArrowLeft" ? b.right <= a.left + 4 :
      dir === "ArrowDown" ? b.top >= a.bottom - 4 : b.bottom <= a.top + 4;
    if (!ok) continue;
    const horizontal = dir === "ArrowLeft" || dir === "ArrowRight";
    const main = Math.abs(horizontal ? dx : dy);
    const cross = Math.abs(horizontal ? dy : dx);
    const score = main + cross * 3;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (!best) return false;
  if (isText(best)) holdKeyboard(best as HTMLInputElement);
  best.focus({ preventScroll: true });
  best.scrollIntoView({ block: "nearest", inline: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return true;
}

/**
 * Reaching a text field with the remote only highlights it; the keyboard opens when the user
 * presses OK (or taps it), not just because focus passed through on the way somewhere else.
 */
function holdKeyboard(input: HTMLInputElement) {
  if (input.readOnly) return;
  input.readOnly = true;
  const release = () => {
    input.readOnly = false;
    input.removeEventListener("keydown", onKey);
    input.removeEventListener("blur", release);
    input.removeEventListener("pointerdown", release);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    release();
    input.blur();
    input.focus(); // focusing again, now writable, brings up the keyboard
  };
  input.addEventListener("keydown", onKey);
  input.addEventListener("blur", release);
  input.addEventListener("pointerdown", release);
}
