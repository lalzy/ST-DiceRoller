import { PRESETS, PRESET_LABEL } from '../../core/constants.js';
import { esc } from '../../core/html.js';
import { dieOptions, cmpOptions } from '../options.js';

function sheetHtml(chars) {
    if (!chars.length) return '';
    return `
        <div class="roll-dice-sheet">
          <label>From sheet <small>(optional)</small></label>
          <div class="roll-dice-row">
            <select id="rd_char" class="text_pole">${chars.map(ch => `<option value="${esc(ch.key)}">${esc(ch.name)}</option>`).join('')}</select>
            <select id="rd_roll" class="text_pole"></select>
          </div>
          <div class="roll-dice-row rd-vs-row" style="display:none">
            <div><label for="rd_vs">Target <small>(armor)</small></label>
              <select id="rd_vs" class="text_pole"></select></div>
          </div>
          <div class="roll-dice-row">
            <div><label for="rd_mod">Modifier</label><input id="rd_mod" class="text_pole" type="number" step="1" value="0"></div>
            <div class="roll-dice-sheet-info"></div>
          </div>
        </div>`;
}

/** Popup markup. */
export function popupHtml(state, chars) {
    return `
      <div class="roll-dice-popup">
        <h3><i class="fa-solid fa-dice"></i> Roll Dice</h3>
        <div class="roll-dice-modes">
          ${PRESETS.map(p => `<div class="menu_button roll-dice-mode" data-preset="${p}">${PRESET_LABEL[p]}</div>`).join('')}
        </div>
        ${sheetHtml(chars)}
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
        <div class="rd-versus-block">
          <label>Versus <small>(optional target)</small></label>
          <div class="roll-dice-row roll-dice-versus">
            <select id="rd_cmp" class="text_pole roll-dice-cmp">${cmpOptions()}</select>
            <input id="rd_target" class="text_pole" type="number" step="1" placeholder="none">
          </div>
        </div>
        <div class="roll-dice-preview"></div>
      </div>`;
}

/** Look up all popup elements once. Sheet elements are null when no sources are registered. */
export function queryElements(root) {
    const $ = (sel) => root.querySelector(sel);
    return {
        skill: $('#rd_skill'), count: $('#rd_count'), die: $('#rd_die'), cmp: $('#rd_cmp'), target: $('#rd_target'),
        preview: $('.roll-dice-preview'), versusBlock: $('.rd-versus-block'),
        char: $('#rd_char'), roll: $('#rd_roll'), mod: $('#rd_mod'), info: $('.roll-dice-sheet-info'),
        vsRow: $('.rd-vs-row'), vs: $('#rd_vs'),
        modes: root.querySelectorAll('.roll-dice-mode'),
    };
}
