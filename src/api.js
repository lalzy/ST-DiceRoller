import { registerSource, unregisterSource } from './core/sources.js';
import { buildRollText } from './rolls/rollText.js';
import { insertIntoInput } from './ui/input.js';
import { openRollPopup } from './ui/popup/index.js';

/** Public API exposed as window.RollDice for other extensions (e.g. NPC Book). */
export function createApi() {
    return {
        version: 2,
        /** Open the roll popup, optionally prefilled: { preset, skill, target, cmp, count, die, rules, character, rollable }. */
        open: (prefill) => openRollPopup(prefill).catch(e => console.error('[RollDice]', e)),
        /** Register a provider of characters and their rollable stats (see core/sources.js). */
        registerSource,
        unregisterSource,
        buildRollText,
        insertIntoInput,
    };
}
