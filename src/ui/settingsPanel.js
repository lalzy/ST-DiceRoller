import { PRESETS, PRESET_LABEL } from '../core/constants.js';
import { esc } from '../core/html.js';
import { settings, saveSettings } from '../core/settings.js';
import { dieOptions, cmpOptions } from './options.js';
import { systemBlock, bindSystem } from './systemPanel.js';

function presetRow(p, s) {
    return `
      <div class="roll-dice-settings-preset" data-preset="${p}">
        <b>${PRESET_LABEL[p]}</b>
        <div class="roll-dice-row">
          <div><label># of dice</label><input class="text_pole rd-set-count" type="number" min="1" max="100" step="1" value="${esc(s[p].count)}"></div>
          <div><label>Die</label><select class="text_pole rd-set-die">${dieOptions(s[p].die)}</select></div>
          <div><label>Versus</label><select class="text_pole rd-set-cmp">${cmpOptions(s[p].cmp)}</select></div>
        </div>
        <div class="roll-dice-row">
          <div><label title="Dice totals that are always a critical success, e.g. 1 or 3-4. Leave empty for none.">Critical success totals</label>
            <input class="text_pole rd-set-crit-s" type="text" placeholder="none" value="${esc(s[p].critSuccess)}"></div>
          <div><label title="Dice totals that are always a critical failure, e.g. 1 or 17-18. Leave empty for none.">Critical failure totals</label>
            <input class="text_pole rd-set-crit-f" type="text" placeholder="none" value="${esc(s[p].critFail)}"></div>
        </div>
      </div>`;
}

function damageRow(s) {
    return `
      <div class="roll-dice-settings-damage">
        <b>Damage</b>
        <div class="roll-dice-row">
          <div><label title="Lowest damage a roll can deal. Empty = 0.">Minimum damage</label>
            <input class="text_pole rd-set-min-dmg" type="number" min="0" step="1" placeholder="0" value="${esc(s.damage.minDamage)}"></div>
          <div><label title="Lowest injury when damage gets through armor. Empty = 0.">Minimum injury</label>
            <input class="text_pole rd-set-min-inj" type="number" min="0" step="1" placeholder="0" value="${esc(s.damage.minInjury)}"></div>
        </div>
        <small>Fill these in from the rules of the game you play. They ship empty.</small>
      </div>`;
}

function bindPreset(box) {
    const p = box.dataset.preset;
    box.querySelector('.rd-set-count').addEventListener('input', (e) => {
        const v = Math.floor(Number(e.target.value));
        if (v >= 1 && v <= 100) { settings()[p].count = v; saveSettings(); }
    });
    box.querySelector('.rd-set-die').addEventListener('change', (e) => { settings()[p].die = Number(e.target.value); saveSettings(); });
    box.querySelector('.rd-set-cmp').addEventListener('change', (e) => { settings()[p].cmp = e.target.value; saveSettings(); });
    box.querySelector('.rd-set-crit-s').addEventListener('input', (e) => { settings()[p].critSuccess = e.target.value; saveSettings(); });
    box.querySelector('.rd-set-crit-f').addEventListener('input', (e) => { settings()[p].critFail = e.target.value; saveSettings(); });
}

function bindDamage(box) {
    box.querySelector('.rd-set-min-dmg').addEventListener('input', (e) => { settings().damage.minDamage = e.target.value; saveSettings(); });
    box.querySelector('.rd-set-min-inj').addEventListener('input', (e) => { settings().damage.minInjury = e.target.value; saveSettings(); });
}

/** Extensions → Roll Dice drawer with per-preset defaults. */
export function mountSettingsPanel() {
    if (document.getElementById('roll_dice_settings')) return;
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) return;
    const s = settings();
    host.insertAdjacentHTML('beforeend', `
      <div id="roll_dice_settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>Roll Dice</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">${PRESETS.map(p => presetRow(p, s)).join('')}${damageRow(s)}${systemBlock()}</div>
      </div>`);
    document.querySelectorAll('#roll_dice_settings .roll-dice-settings-preset').forEach(bindPreset);
    bindDamage(document.querySelector('#roll_dice_settings .roll-dice-settings-damage'));
    bindSystem(document.querySelector('#roll_dice_settings .roll-dice-settings-system'));
}
