import { PRESETS, PRESET_LABEL } from '../core/constants.js';
import { esc } from '../core/html.js';
import { settings, saveSettings } from '../core/settings.js';
import { dieOptions, cmpOptions } from './options.js';

function presetRow(p, s) {
    return `
      <div class="roll-dice-settings-preset" data-preset="${p}">
        <b>${PRESET_LABEL[p]}</b>
        <div class="roll-dice-row">
          <div><label># of dice</label><input class="text_pole rd-set-count" type="number" min="1" max="100" step="1" value="${esc(s[p].count)}"></div>
          <div><label>Die</label><select class="text_pole rd-set-die">${dieOptions(s[p].die)}</select></div>
          <div><label>Versus</label><select class="text_pole rd-set-cmp">${cmpOptions(s[p].cmp)}</select></div>
        </div>
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
        <div class="inline-drawer-content">${PRESETS.map(p => presetRow(p, s)).join('')}</div>
      </div>`);
    document.querySelectorAll('#roll_dice_settings .roll-dice-settings-preset').forEach(bindPreset);
}
