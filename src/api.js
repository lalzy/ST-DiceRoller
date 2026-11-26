import { registerSource, unregisterSource, sourceCharacters, setCombatActive, combatActive } from './core/sources.js';
import { buildRollText, buildMultiText } from './rolls/rollText.js';
import { rollDie } from './rolls/dice.js';
import { insertIntoInput, sendRoll } from './ui/input.js';
import { openRollPopup } from './ui/popup/index.js';
import { systemApi } from './system/index.js';

/** Public API exposed as window.RollDice for other extensions (e.g. NPC Book, Combat Mode). */
export function createApi() {
    return {
        version: 5,
        /** Open the roll popup, optionally prefilled: { preset, skill, target, cmp, count, die, rules, character, rollable }. */
        open: (prefill) => openRollPopup(prefill).catch(e => console.error('[RollDice]', e)),
        /** Register a provider of characters and their rollable stats (see core/sources.js). */
        registerSource,
        unregisterSource,
        /** All characters from registered sources: [{ key: 'sourceId:charKey', name, rules?, dr?, rollables, combat, ... }]. */
        getCharacters: () => sourceCharacters().map(({ source, ...ch }) => ({ ...ch, sourceId: source.id })),
        /** Unbiased integer in [1, sides]. */
        rollDie: (sides) => rollDie(sides),
        buildRollText,
        /** Several dice groups with their own modifiers (version 5+): { skill, groups: [{ n, die, mod }], cmp, target, crit }. */
        buildMultiText,
        insertIntoInput,
        /** Send text as the user's message right away, after anything already typed (version 5+). */
        sendRoll,
        /** A combat plugin calls setCombatActive(true) while it runs (version 5+): the popup then offers checks only. null = detect. */
        setCombatActive,
        combatActive,
        /** Game system packs (version 4+): how checks are rolled and read. See src/system/. */
        system: systemApi(),
    };
}
