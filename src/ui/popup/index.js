import { PRESETS } from '../../core/constants.js';
import { ctx } from '../../core/context.js';
import { settings } from '../../core/settings.js';
import { validCmp } from '../../core/validate.js';
import { sourceCharacters } from '../../core/sources.js';
import { buildRollText, previewText } from '../../rolls/rollText.js';
import { insertIntoInput } from '../input.js';
import { popupHtml, queryElements } from './template.js';
import { setupSheetPicker } from './sheetPicker.js';

const PREFILL_KEYS = ['skill', 'target', 'count', 'die', 'cmp', 'rules'];

function initialState(prefill) {
    const s = settings();
    const preset = PRESETS.includes(prefill.preset) ? prefill.preset : 'skill';
    const state = { preset, skill: '', target: '', rules: null, damage: null, ...s[preset] };
    for (const k of PREFILL_KEYS) if (prefill[k] !== undefined && prefill[k] !== null) state[k] = prefill[k];
    return state;
}

/**
 * Open the roll popup, optionally prefilled:
 * { preset, skill, target, cmp, count, die, rules, character, rollable }.
 * On "Roll", the result is inserted into the chat input.
 */
export async function openRollPopup(prefill = {}) {
    const c = ctx();
    const state = initialState(prefill);
    const chars = sourceCharacters();
    const ui = { picked: null };

    const popup = new c.Popup(popupHtml(state, chars), c.POPUP_TYPE.CONFIRM, '', { okButton: 'Roll', cancelButton: 'Cancel' });
    const showing = popup.show();
    const el = queryElements(popup.dlg);

    const updatePreview = () => { el.preview.textContent = previewText(state); };
    const render = () => {
        el.count.value = state.count;
        el.die.value = String(state.die);
        el.cmp.value = state.cmp;
        el.skill.value = state.skill || '';
        el.target.value = state.target ?? '';
        el.versusBlock.style.display = state.damage ? 'none' : '';
        el.modes.forEach(b => b.classList.toggle('roll-dice-mode-active', b.dataset.preset === state.preset));
        updatePreview();
    };
    const read = () => {
        // editing the name by hand detaches the roll from the sheet pick
        if (ui.picked && el.skill.value !== state.skill) { ui.picked = null; state.rules = null; state.damage = null; }
        state.skill = el.skill.value;
        state.count = el.count.value;
        state.die = Number(el.die.value);
        state.target = el.target.value;
        updatePreview();
    };

    const sheet = setupSheetPicker({ el, state, ui, chars, prefill, render });

    el.modes.forEach(b => b.addEventListener('click', () => {
        state.preset = b.dataset.preset;
        ui.picked = null; state.damage = null; state.rules = null; state.skill = ''; state.target = '';
        Object.assign(state, settings()[state.preset]);
        sheet.refresh();
        render();
    }));
    el.cmp.addEventListener('change', () => {
        state.cmp = validCmp(el.cmp.value) ?? state.cmp;
        updatePreview();
    });
    [el.skill, el.count, el.die, el.target].forEach(input => {
        input.addEventListener('input', read);
        input.addEventListener('change', read);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); read(); popup.complete(c.POPUP_RESULT.AFFIRMATIVE); }
        });
    });

    render();
    if (el.char && prefill.rollable) sheet.applyPick();
    setTimeout(() => el.skill.focus(), 50);

    const result = await showing;
    if (result !== c.POPUP_RESULT.AFFIRMATIVE) return;
    insertIntoInput(buildRollText(state));
}
