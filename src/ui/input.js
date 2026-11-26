/** Insert text at the caret in ST's chat input, padding with spaces as needed. */
export function insertIntoInput(text) {
    const ta = /** @type {HTMLTextAreaElement} */ (document.getElementById('send_textarea'));
    if (!ta) return;
    const cur = ta.value;
    const start = ta.selectionStart ?? cur.length;
    const end = ta.selectionEnd ?? cur.length;
    const before = cur.slice(0, start);
    const after = cur.slice(end);
    const pre = before && !/\s$/.test(before) ? ' ' : '';
    const post = after && !/^\s/.test(after) ? ' ' : '';
    ta.value = before + pre + text + post + after;
    const caret = (before + pre + text).length;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    ta.setSelectionRange(caret, caret);
}

/**
 * Send a roll as the user's message, straight away, so the result can't be edited before it is posted.
 * Text already typed in the chat input goes first, in the same message ("I swing at him. Sword Roll (…): …").
 * Falls back to inserting into the input when ST's send button isn't there.
 */
export function sendRoll(text) {
    const ta = /** @type {HTMLTextAreaElement} */ (document.getElementById('send_textarea'));
    const btn = document.getElementById('send_but');
    if (!ta || !btn) { insertIntoInput(text); return; }
    const draft = ta.value.trim();
    ta.value = draft ? `${draft} ${text}` : text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    btn.click();
}
