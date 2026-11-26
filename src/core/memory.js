// What the roll popup remembers between uses: the last roll, recent rolls and saved presets (all in settings).
import { MODULE } from './constants.js';
import { ctx } from './context.js';

const RECENT_MAX = 6;
const SAVED_MAX = 30;

function store() {
    const all = ctx().extensionSettings;
    all[MODULE] ||= {};
    const s = all[MODULE];
    const m = s.memory && typeof s.memory === 'object' ? s.memory : (s.memory = {});
    if (!m.last || typeof m.last !== 'object') m.last = {};
    if (!Array.isArray(m.recent)) m.recent = [];
    if (!Array.isArray(m.saved)) m.saved = [];
    return m;
}

const save = () => ctx().saveSettingsDebounced?.();
const same = (a, b) => a.label === b.label && a.kind === b.kind;

/**
 * An entry is { label, kind: 'manual', manual: { name, groups: [{ n, die, mod }], cmp, target } }
 * or { label, kind: 'sheet', tab: 'check' | 'attack' | 'damage', charKey, charName, name, mod, vs }.
 */
export const lastRoll = (surface) => store().last[surface] || null;
export const recentRolls = () => store().recent;
export const savedRolls = () => store().saved;

/** Remember a roll that was made: it opens next time and goes first in Recent. */
export function remember(surface, entry) {
    const m = store();
    m.last[surface] = structuredClone(entry);
    m.recent = [structuredClone(entry), ...m.recent.filter(e => !same(e, entry))].slice(0, RECENT_MAX);
    save();
}

/** Keep the last selection without counting it as a roll (e.g. the follow-up damage pick). */
export function setLast(surface, entry) {
    store().last[surface] = structuredClone(entry);
    save();
}

export function savePreset(entry) {
    const m = store();
    m.saved = [...m.saved.filter(e => !same(e, entry)), structuredClone(entry)].slice(-SAVED_MAX);
    save();
}

export function removePreset(index) {
    const m = store();
    m.saved.splice(index, 1);
    save();
}
