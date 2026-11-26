/**
 * Roll sources registered by other extensions (e.g. NPC Book character sheets).
 * source = { id, label, getCharacters(): [{ key, name, rules?: string, rollables: [{ group, name, target }] }] }
 */
const sources = new Map();

export function registerSource(src) {
    if (src?.id && typeof src.getCharacters === 'function') sources.set(src.id, src);
}

export function unregisterSource(id) {
    return sources.delete(id);
}

/** Characters offered by registered sources (errors in one source don't break the popup). */
export function sourceCharacters() {
    const out = [];
    for (const src of sources.values()) {
        try {
            for (const ch of src.getCharacters() || []) {
                if (!ch) continue;
                const hasSkill = Array.isArray(ch.rollables) && ch.rollables.length;
                const hasCombat = Array.isArray(ch.combat) && ch.combat.length;
                if (hasSkill || hasCombat) out.push({ ...ch, rollables: ch.rollables || [], combat: ch.combat || [], key: `${src.id}:${ch.key}`, source: src });
            }
        } catch (e) { console.warn('[RollDice] source failed', src.id, e); }
    }
    return out;
}

// ── Combat plugin ──────────────────────────────────────────────────────
// When a combat plugin is running it rolls attacks, defenses and damage itself, so the popup offers checks only.
// It can say so with RollDice.setCombatActive(true); otherwise it is detected by its global or its loaded script.
let combatFlag = null;

/** true / false: set by the combat plugin; null: detect. */
export function setCombatActive(v) {
    combatFlag = v === null || v === undefined ? null : !!v;
}

export function combatActive() {
    if (combatFlag !== null) return combatFlag;
    if (typeof window === 'undefined') return false;
    if (window.NPCBookCombat || window.CombatMode) return true;
    try {
        return [...document.querySelectorAll('script[src]')].some(sc => /\/(NPC-?Book-?Combat|Combat-?Mode)[^/]*\//i.test(sc.getAttribute('src') || ''));
    } catch { return false; }
}
