import { registerSource, unregisterSource, sourceCharacters } from './core/sources.js';
import { buildRollText } from './rolls/rollText.js';
import { rollDie } from './rolls/dice.js';
import { insertIntoInput } from './ui/input.js';
import { openRollPopup } from './ui/popup/index.js';

/** Public API exposed as window.RollDice for other extensions (e.g. NPC Book, GURPS Combat). */
export function createApi() {
    return {
        version: 3,
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
        insertIntoInput,
    };
}
