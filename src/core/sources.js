/**
 * Roll sources registered by other extensions (e.g. NPC Book — GURPS).
 * source = { id, label, getCharacters(): [{ key, name, rules?: 'gurps', rollables: [{ group, name, target }] }] }
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
