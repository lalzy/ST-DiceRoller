// Popup markup. Rendered from the popup's view state (see index.js); all text is escaped.
import { DIE_TYPES, COMPARATORS } from '../../core/constants.js';
import { esc } from '../../core/html.js';
import { listFor, valueText, attackMeta, groupOf, plainName } from './sheetPicker.js';

export const TAB_LABEL = { check: 'Check', attack: 'Attack', damage: 'Damage', custom: 'Custom dice' };
const CMP_LABEL = { '>': '> over', '>=': '≥ meet or beat', '<': '< under', '<=': '≤ roll under' };

const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(label)}</option>`;

const stepper = (field, value, title = '') => `
    <div class="rd-step"${title ? ` title="${esc(title)}"` : ''}>
      <button type="button" class="menu_button rd-step-btn" data-step="-1" tabindex="-1">−</button>
      <input class="text_pole" type="number" step="1" data-f="${field}" value="${esc(value)}">
      <button type="button" class="menu_button rd-step-btn" data-step="1" tabindex="-1">+</button>
    </div>`;

function chipsHtml(v) {
    const saved = v.saved.map(({ e, i }) => `<span class="rd-chip rd-chip-saved" data-act="saved" data-i="${i}" title="Use this preset">★ ${esc(e.label)}<b class="rd-chip-x" data-act="unsave" data-i="${i}" title="Remove preset">×</b></span>`).join('');
    const recent = v.recent.map(({ e, i }) => `<span class="rd-chip rd-chip-recent" data-act="recent" data-i="${i}" title="Roll this again">↺ ${esc(e.label)}</span>`).join('');
    if (!saved && !recent) return '';
    return `<div class="rd-chips">${saved}${recent}</div>`;
}

function manualHtml(m) {
    const groups = m.groups.map((g, i) => `
      <div class="rd-group">
        ${stepper(`gn:${i}`, g.n, 'Number of dice')}
        <select class="text_pole rd-die" data-f="gdie:${i}" title="Die">${DIE_TYPES.map(d => opt(d, `d${d}`, g.die)).join('')}</select>
        ${stepper(`gmod:${i}`, g.mod, 'Modifier for these dice')}
        ${m.groups.length > 1 ? `<button type="button" class="menu_button rd-del" data-act="delg" data-i="${i}" title="Remove these dice">×</button>` : '<span class="rd-del-pad"></span>'}
      </div>`).join('');
    return `
      <div class="rd-field"><label>Name <small>(optional)</small></label>
        <input class="text_pole" type="text" data-f="mname" value="${esc(m.name)}" placeholder="e.g. Persuasion" autocomplete="off"></div>
      <div class="rd-field"><label class="rd-group-head"><span>Dice</span><span>Die</span><span>Modifier</span><span></span></label>${groups}
        <button type="button" class="menu_button rd-add" data-act="addg">+ Add dice</button></div>
      <div class="rd-row">
        <div class="rd-field"><label>Versus <small>(optional)</small></label>
          <select class="text_pole" data-f="cmp">${COMPARATORS.map(c => opt(c, CMP_LABEL[c] || c, m.cmp)).join('')}</select></div>
        <div class="rd-field"><label>Target</label>
          <input class="text_pole" type="number" step="1" data-f="target" value="${esc(m.target)}" placeholder="none"></div>
      </div>`;
}

/** The list of picks for a sheet tab, grouped, filtered by the search text. */
export function listHtml(v) {
    const f = v.filter.trim().toLowerCase();
    const items = listFor(v.tab, v.char, v.defenses).map((r, i) => ({ r, i })).filter(({ r }) => !f || `${r.name} ${r.group || ''} ${r.item || ''}`.toLowerCase().includes(f));
    if (!items.length) return `<div class="rd-empty">${f ? 'Nothing matches.' : v.tab === 'check' ? 'This sheet has nothing to roll.' : `No ${TAB_LABEL[v.tab].toLowerCase()} rolls on this sheet.`}</div>`;
    let last = null;
    return items.map(({ r, i }) => {
        const g = groupOf(v.tab, r);
        const head = g !== last ? `<div class="rd-list-group">${esc(g)}</div>` : '';
        last = g;
        const meta = v.tab === 'attack' ? attackMeta(r) : (r.note && v.tab !== 'damage' ? String(r.note) : '');
        const on = v.pickIndex === i ? ' rd-on' : '';
        return `${head}<div class="rd-item${on}" data-act="pick" data-i="${i}" title="Double-click to roll">
          <span class="rd-item-name">${esc(r.name)}${meta ? `<small>${esc(meta)}</small>` : ''}</span><i>${esc(valueText(v.pack, v.tab, r))}</i></div>`;
    }).join('');
}

function sheetHtml(v) {
    const others = v.chars.filter(ch => ch.key !== v.char?.key);
    const vsLabel = (ch) => {
        if (v.tab === 'damage') return v.pack.armor === 'reduce' ? `${plainName(ch)} (armor ${Number(ch.dr) || 0})` : plainName(ch);
        if (v.pack.test === 'over' && v.pack.defense.model === 'passive' && ch.ac !== null && ch.ac !== undefined) return `${plainName(ch)} (${v.pack.defense.passiveName} ${ch.ac})`;
        return plainName(ch);
    };
    const target = v.tab === 'attack' || v.tab === 'damage' ? `
      <div class="rd-field"><label>Target</label>
        <select class="text_pole" data-f="vs">${opt('', '— none —', v.vs)}${others.map(ch => opt(ch.key, vsLabel(ch), v.vs)).join('')}</select></div>` : '';
    const dc = v.pack.test === 'over' && v.tab !== 'damage' ? `
      <div class="rd-field"><label>${esc(v.tab === 'attack' && v.pack.defense.model === 'passive' ? v.pack.defense.passiveName : v.pack.labels.target)}</label>
        <input class="text_pole" type="number" step="1" data-f="dc" value="${esc(v.dc)}" placeholder="${esc(v.dcDefault ?? '')}"></div>` : '';
    return `
      <input class="text_pole rd-filter" type="search" data-f="filter" value="${esc(v.filter)}" placeholder="Filter…" autocomplete="off">
      <div class="rd-list">${listHtml(v)}</div>
      <div class="rd-row">${target}${dc}
        <div class="rd-field"><label>Modifier</label>${stepper('mod', v.mod, 'Situational modifier')}</div></div>`;
}

/** The whole popup body. */
export function bodyHtml(v) {
    const chars = v.chars.length ? `
      <div class="rd-field"><label>Character</label>
        <select class="text_pole" data-f="char">${v.chars.map(ch => opt(ch.key, ch.name, v.char?.key)).join('')}</select></div>` : '';
    const tabs = v.tabs.length > 1 ? `<div class="rd-tabs">${v.tabs.map(t => `<div class="rd-tab${t === v.tab ? ' rd-on' : ''}" data-act="tab" data-tab="${t}">${TAB_LABEL[t]}</div>`).join('')}</div>` : '';
    const note = v.combat && v.chars.length ? '<div class="rd-note">Attacks, defenses and damage are rolled by the combat plugin.</div>' : '';
    return `
      <div class="rd-head"><span><i class="fa-solid fa-dice"></i> Roll Dice</span><small title="Game system for this chat">${esc(v.pack.name)}</small></div>
      ${chipsHtml(v)}
      ${chars}
      ${tabs}
      <div class="rd-body">${v.tab === 'custom' ? manualHtml(v.manual) : sheetHtml(v)}</div>
      <div class="rd-info"></div>
      <div class="rd-preview"></div>
      ${note}
      <div class="rd-foot"><span class="rd-save" data-act="save" title="Keep this roll as a preset">☆ Save as preset</span></div>`;
}
