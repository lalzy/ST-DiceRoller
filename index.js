// Roll Dice – wand menu action.
// The extension rolls the dice itself and inserts the finished result into the input box, e.g.
//   Persuasion Roll (3d6 vs <= 12): 4 + 2 + 6 = 12 (Success)
// Two presets (Skill / Combat) with their own default dice and versus comparator, set in Extensions → Roll Dice.
//
// Entry point only – see src/ for the implementation.

import { settings } from './src/core/settings.js';
import { createApi } from './src/api.js';
import { mountSettingsPanel } from './src/ui/settingsPanel.js';
import { mountWandButton } from './src/ui/wandButton.js';

// Re-exported for tests / other modules (same exports as the old single-file version).
export { rollDie } from './src/rolls/dice.js';
export { buildRollText } from './src/rolls/rollText.js';
export { rollVerdict, parseTotals } from './src/rolls/verdict.js';

(function init() {
    if (typeof SillyTavern === 'undefined') return; // loaded outside ST (tests)
    window.RollDice = createApi();
    document.dispatchEvent(new CustomEvent('rolldice:ready', { detail: window.RollDice }));
    settings();
    mountSettingsPanel();
    mountWandButton();
})();
