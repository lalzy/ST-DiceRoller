// Roll Dice – wand menu action.
// The extension rolls the dice itself and inserts the finished result into the input box, e.g.
//   Persuasion Roll (3d6 vs <= 12): 4 + 2 + 6 = 12 (Success)
// Two presets (Skill / Combat) with their own default dice and versus comparator, set in Extensions → Roll Dice.

const MODULE = 'roll_dice';
const DIE_TYPES = [1, 2, 3, 4, 6, 8, 10, 12, 20, 100];
const COMPARATORS = ['>', '>=', '<', '<='];
const PRESETS = ['skill', 'combat'];
const PRESET_LABEL = { skill: 'Skill', combat: 'Combat' };
const DEFAULTS = {
    skill: { count: 3, die: 6, cmp: '<=' },   // GURPS-style: roll under skill
    combat: { count: 1, die: 20, cmp: '>=' }, // D&D-style: meet or beat AC/DC
};

const ctx = () => SillyTavern.getContext();

function clampCount(v) {
    return Math.min(100, Math.max(1, Math.floor(Number(v) || 1)));
}
function validDie(v) {
    return DIE_TYPES.includes(Number(v)) ? Number(v) : null;
}
function validCmp(v) {
    return COMPARATORS.includes(v) ? v : null;
}

function settings() {
    const all = ctx().extensionSettings;
    const s = all[MODULE] || {};
    // migrate v1/v2 settings ({count, die}) into the skill preset
    if (!s.skill && (s.count || s.die)) s.skill = { count: s.count, die: s.die };
    for (const p of PRESETS) {
        const cur = s[p] || {};
        s[p] = {
            count: clampCount(cur.count ?? DEFAULTS[p].count),
            die: validDie(cur.die) ?? DEFAULTS[p].die,
            cmp: validCmp(cur.cmp) ?? DEFAULTS[p].cmp,
        };
    }
    delete s.count; delete s.die;
    all[MODULE] = s;
    return s;
}

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Unbiased integer in [1, sides]. */
export function rollDie(sides, rand = cryptoRandom) {
    if (sides <= 1) return 1;
    const limit = Math.floor(0x100000000 / sides) * sides;
    let x;
    do { x = rand(); } while (x >= limit);
    return (x % sides) + 1;
}
function cryptoRandom() {
    return crypto.getRandomValues(new Uint32Array(1))[0];
}

function compare(total, cmp, target) {
    switch (cmp) {
        case '>': return total > target;
        case '>=': return total >= target;
        case '<': return total < target;
        case '<=': return total <= target;
    }
    return false;
}

/** Parse the versus target; '' / invalid → null (no versus). */
function parseTarget(v) {
    const t = String(v ?? '').trim();
    if (!/^-?\d+$/.test(t)) return null;
    return Number(t);
}

/**
 * Roll and build the text inserted into the chat input.
 * @param {{skill?: string, count: number, die: number, cmp?: string, target?: string|number}} o
 * @param {number[]} [forced] dice results (for tests)
 */
export function buildRollText(o, forced) {
    const n = clampCount(o.count);
    const d = validDie(o.die) ?? 20;
    const name = String(o.skill ?? '').replace(/\s+/g, ' ').trim();
    const target = parseTarget(o.target);
    const cmp = validCmp(o.cmp) ?? '>=';
    const dice = forced ?? Array.from({ length: n }, () => rollDie(d));
    const total = dice.reduce((a, b) => a + b, 0);

    const label = `${name ? `${name} Roll` : 'Roll'} (${n}d${d}${target !== null ? ` vs ${cmp} ${target}` : ''})`;
    const math = n > 1 ? `${dice.join(' + ')} = ${total}` : `${total}`;
    const verdict = target !== null ? ` (${compare(total, cmp, target) ? 'Success' : 'Failure'})` : '';
    return `${label}: ${math}${verdict}`;
}

/** Same shape as buildRollText, without rolling – for the popup preview. */
function previewText(o) {
    const n = clampCount(o.count);
    const d = validDie(o.die) ?? 20;
    const name = String(o.skill ?? '').replace(/\s+/g, ' ').trim();
    const target = parseTarget(o.target);
    return `${name ? `${name} Roll` : 'Roll'} (${n}d${d}${target !== null ? ` vs ${o.cmp} ${target}` : ''}): …`;
}

function insertIntoInput(text) {
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

function dieOptions(selected) {
    return DIE_TYPES.map(d => `<option value="${d}"${d === Number(selected) ? ' selected' : ''}>d${d}</option>`).join('');
}

async function openRollPopup() {
    const c = ctx();
    const s = settings();
    const state = { preset: 'skill', skill: '', target: '', ...s.skill };

    const html = `
      <div class="roll-dice-popup">
        <h3><i class="fa-solid fa-dice"></i> Roll Dice</h3>
        <div class="roll-dice-modes">
          ${PRESETS.map(p => `<div class="menu_button roll-dice-mode" data-preset="${p}">${PRESET_LABEL[p]}</div>`).join('')}
        </div>
        <label for="rd_skill">Name <small>(optional)</small></label>
        <input id="rd_skill" class="text_pole" type="text" placeholder="e.g. Persuasion / Attack" autocomplete="off">
        <div class="roll-dice-row">
          <div>
            <label for="rd_count"># of dice</label>
            <input id="rd_count" class="text_pole" type="number" min="1" max="100" step="1">
          </div>
          <div>
            <label for="rd_die">Die</label>
            <select id="rd_die" class="text_pole">${dieOptions(state.die)}</select>
          </div>
        </div>
        <label>Versus <small>(optional target)</small></label>
        <div class="roll-dice-row roll-dice-versus">
          <select id="rd_cmp" class="text_pole roll-dice-cmp">${COMPARATORS.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
          <input id="rd_target" class="text_pole" type="number" step="1" placeholder="none">
        </div>
        <div class="roll-dice-preview"></div>
      </div>`;

    const popup = new c.Popup(html, c.POPUP_TYPE.CONFIRM, '', { okButton: 'Roll', cancelButton: 'Cancel' });
    const showing = popup.show();

    const root = popup.dlg;
    const $ = (sel) => root.querySelector(sel);
    const skillEl = $('#rd_skill'), countEl = $('#rd_count'), dieEl = $('#rd_die'), cmpEl = $('#rd_cmp'), targetEl = $('#rd_target');
    const preview = $('.roll-dice-preview');

    const render = () => {
        countEl.value = state.count;
        dieEl.value = String(state.die);
        cmpEl.value = state.cmp;
        root.querySelectorAll('.roll-dice-mode').forEach(b => b.classList.toggle('roll-dice-mode-active', b.dataset.preset === state.preset));
        preview.textContent = previewText(state);
    };
    const read = () => {
        state.skill = skillEl.value;
        state.count = countEl.value;
        state.die = Number(dieEl.value);
        state.target = targetEl.value;
        preview.textContent = previewText(state);
    };

    root.querySelectorAll('.roll-dice-mode').forEach(b => b.addEventListener('click', () => {
        state.preset = b.dataset.preset;
        Object.assign(state, settings()[state.preset]);
        render();
    }));
    cmpEl.addEventListener('change', () => {
        state.cmp = validCmp(cmpEl.value) ?? state.cmp;
        preview.textContent = previewText(state);
    });
    [skillEl, countEl, dieEl, targetEl].forEach(el => {
        el.addEventListener('input', read);
        el.addEventListener('change', read);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); read(); popup.complete(c.POPUP_RESULT.AFFIRMATIVE); }
        });
    });
    render();
    setTimeout(() => skillEl.focus(), 50);

    const result = await showing;
    if (result !== c.POPUP_RESULT.AFFIRMATIVE) return;
    insertIntoInput(buildRollText(state));
}

function addWandButton() {
    if (document.getElementById('roll_dice_wand')) return;
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return;
    const item = document.createElement('div');
    item.id = 'roll_dice_wand';
    item.className = 'list-group-item flex-container flexGap5';
    item.title = 'Roll dice and insert the result into your message';
    item.innerHTML = '<div class="fa-solid fa-dice extensionsMenuExtensionButton"></div><span>Roll Dice</span>';
    item.addEventListener('click', () => {
        const btn = document.getElementById('extensionsMenuButton');
        if (document.getElementById('extensionsMenu')?.style.display !== 'none') btn?.click();
        openRollPopup().catch(e => console.error('[RollDice]', e));
    });
    menu.appendChild(item);
}

function addSettingsUi() {
    if (document.getElementById('roll_dice_settings')) return;
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) return;
    const s = settings();
    const row = (p) => `
      <div class="roll-dice-settings-preset" data-preset="${p}">
        <b>${PRESET_LABEL[p]}</b>
        <div class="roll-dice-row">
          <div><label># of dice</label><input class="text_pole rd-set-count" type="number" min="1" max="100" step="1" value="${esc(s[p].count)}"></div>
          <div><label>Die</label><select class="text_pole rd-set-die">${dieOptions(s[p].die)}</select></div>
          <div><label>Versus</label><select class="text_pole rd-set-cmp">${COMPARATORS.map(c => `<option${c === s[p].cmp ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        </div>
      </div>`;
    host.insertAdjacentHTML('beforeend', `
      <div id="roll_dice_settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>Roll Dice</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">${PRESETS.map(row).join('')}</div>
      </div>`);
    document.querySelectorAll('#roll_dice_settings .roll-dice-settings-preset').forEach(box => {
        const p = box.dataset.preset;
        box.querySelector('.rd-set-count').addEventListener('input', (e) => {
            const v = Math.floor(Number(e.target.value));
            if (v >= 1 && v <= 100) { settings()[p].count = v; ctx().saveSettingsDebounced(); }
        });
        box.querySelector('.rd-set-die').addEventListener('change', (e) => { settings()[p].die = Number(e.target.value); ctx().saveSettingsDebounced(); });
        box.querySelector('.rd-set-cmp').addEventListener('change', (e) => { settings()[p].cmp = e.target.value; ctx().saveSettingsDebounced(); });
    });
}

(function init() {
    if (typeof SillyTavern === 'undefined') return; // loaded outside ST (tests)
    settings();
    addSettingsUi();
    addWandButton();
    if (!document.getElementById('roll_dice_wand')) {
        const t = setInterval(() => { addWandButton(); if (document.getElementById('roll_dice_wand')) clearInterval(t); }, 500);
        setTimeout(() => clearInterval(t), 30000);
    }
})();
