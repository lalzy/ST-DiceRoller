import { ctx } from '../../core/context.js';
import { settings } from '../../core/settings.js';
import { validCmp, validDie, clampCount } from '../../core/validate.js';
import { sourceCharacters, combatActive } from '../../core/sources.js';
import { lastRoll, recentRolls, savedRolls, remember, setLast, savePreset, removePreset } from '../../core/memory.js';
import { buildRollText, previewText, buildMultiText, previewMulti, cleanGroups } from '../../rolls/rollText.js';
import { signedAdd } from '../../rolls/dice.js';
import { activePack } from '../../system/index.js';
import { sendRoll } from '../input.js';
import { bodyHtml, listHtml } from './template.js';
import { listFor, damageFor, testRoll, damageRoll, defaultDc, plainName } from './sheetPicker.js';

const SHEET_TABS = ['check', 'attack', 'damage'];
const clone = (o) => structuredClone(o);
const int = (v) => Math.trunc(Number(v) || 0);

/** Hand-rolled dice to start from: the last ones used, else the Skill preset from the settings. */
function startManual() {
    const last = lastRoll('manual');
    if (last && Array.isArray(last.groups) && cleanGroups(last.groups).length) return { name: '', cmp: '<=', target: '', ...clone(last), groups: cleanGroups(last.groups) };
    const s = settings().skill;
    return { name: '', groups: [{ n: clampCount(s.count), die: validDie(s.die) ?? 6, mod: 0 }], cmp: validCmp(s.cmp) ?? '<=', target: '' };
}

const manualLabel = (m) => {
    const dice = cleanGroups(m.groups).map(g => `${g.n}d${g.die}${signedAdd(g.mod)}`).join(' + ');
    const t = String(m.target ?? '').trim();
    return `${m.name ? `${String(m.name).trim()} ` : ''}${dice}${t !== '' ? ` ${m.cmp} ${t}` : ''}`.trim();
};

/**
 * Open the roll popup. prefill (all optional):
 *   { preset, skill, target, cmp, count, die, character, rollable }  → a sheet pick, or hand-rolled dice
 *   { entry }                                                         → a remembered roll / preset
 * On "Roll", the result is sent as the user's message (after anything already typed), so it can't be edited first.
 */
export async function openRollPopup(prefill = {}) {
    const c = ctx();
    const pack = activePack();
    const chars = sourceCharacters();
    const combat = combatActive();
    const tabs = chars.length ? (combat ? ['check', 'custom'] : [...SHEET_TABS, 'custom']) : ['custom'];

    const st = {
        tab: tabs[0], charKey: chars[0]?.key || '', picks: { check: '', attack: '', damage: '' },
        filter: '', mod: 0, vs: '', dc: '', manual: startManual(),
    };
    const curChar = () => chars.find(ch => ch.key === st.charKey) || chars[0] || null;
    const vsChar = () => chars.find(ch => ch.key === st.vs) || null;
    const list = () => listFor(st.tab, curChar(), !combat);
    const pickIndex = () => (st.tab === 'custom' ? -1 : list().findIndex(r => r.name === st.picks[st.tab]));
    const picked = () => list()[pickIndex()] || null;

    /** Can this remembered roll be made here (its tab is offered and its character is in the scene)? */
    const usable = (e) => {
        if (!e) return false;
        if (e.kind === 'manual') return true;
        return chars.length > 0 && tabs.includes(e.tab) && chars.some(ch => ch.key === e.charKey || ch.name === e.charName);
    };
    const applyEntry = (e) => {
        if (!usable(e)) return false;
        if (e.kind === 'manual') {
            st.manual = { name: '', cmp: '<=', target: '', ...clone(e.manual), groups: cleanGroups(e.manual?.groups) };
            if (!st.manual.groups.length) st.manual.groups = startManual().groups;
            st.tab = 'custom';
            return true;
        }
        const ch = chars.find(x => x.key === e.charKey) || chars.find(x => x.name === e.charName);
        st.charKey = ch.key; st.tab = e.tab; st.picks[e.tab] = e.name; st.mod = int(e.mod);
        st.vs = chars.some(x => x.key === e.vs) ? e.vs : ''; st.dc = ''; st.filter = '';
        return true;
    };
    const applyPrefill = () => {
        if (prefill.entry) return applyEntry(prefill.entry);
        if (prefill.rollable && chars.length) {
            const ch = (prefill.character && chars.find(x => x.key.endsWith(`:${prefill.character}`))) || chars[0];
            st.charKey = ch.key;
            const order = prefill.preset === 'combat' ? ['attack', 'damage', 'check'] : ['check', 'attack', 'damage'];
            for (const t of order.filter(x => tabs.includes(x))) {
                if (listFor(t, ch, !combat).some(r => r.name === prefill.rollable)) { st.tab = t; st.picks[t] = prefill.rollable; return true; }
            }
        }
        if (['skill', 'count', 'die', 'target'].some(k => prefill[k] !== undefined && prefill[k] !== null)) {
            const m = st.manual;
            if (prefill.skill !== undefined) m.name = String(prefill.skill ?? '');
            if (prefill.count !== undefined || prefill.die !== undefined) m.groups = [{ n: clampCount(prefill.count ?? m.groups[0]?.n), die: validDie(prefill.die) ?? m.groups[0]?.die ?? 6, mod: 0 }];
            if (validCmp(prefill.cmp)) m.cmp = prefill.cmp;
            if (prefill.target !== undefined) m.target = String(prefill.target ?? '');
            st.tab = 'custom';
            return true;
        }
        return false;
    };
    if (!applyPrefill()) applyEntry(lastRoll('popup'));

    /** The roll the popup would make now: { kind, args, info, entry } or null. */
    const current = () => {
        if (st.tab === 'custom') {
            const m = st.manual;
            const { critSuccess, critFail } = settings().skill;
            return { kind: 'manual', args: { skill: m.name, groups: m.groups, cmp: m.cmp, target: m.target, crit: { critSuccess, critFail } }, info: '',
                entry: { kind: 'manual', label: manualLabel(m) || 'Roll', manual: clone(m) } };
        }
        const ch = curChar();
        const r = picked();
        if (!ch || !r) return null;
        const entry = { kind: 'sheet', tab: st.tab, charKey: ch.key, charName: ch.name, name: r.name, mod: st.mod, vs: st.vs,
            label: `${plainName(ch)}: ${r.name}${st.mod ? ` ${signedAdd(st.mod)}` : ''}` };
        if (st.tab === 'damage') {
            const { minDamage, minInjury } = settings().damage;
            return { kind: 'damage', r, entry, ...damageRoll(pack, ch, r, { mod: st.mod, vs: vsChar(), minDamage, minInjury }) };
        }
        if (st.tab === 'attack' && r.hits === 'auto') {
            const d = damageFor(ch, r);
            if (!d && r.amount && Number(r.amount.n) > 0) {
                // e.g. a healing potion: nothing to hit, only its amount to roll
                const a = r.amount;
                const args = { skill: `${ch.prefix ? `${ch.prefix} ` : ''}${r.name}${r.fx ? ` ${r.fx}` : ''}`, count: a.n, die: Number(a.sides) || 6, bonus: (Number(a.add) || 0) + st.mod };
                return { kind: 'amount', r, entry, args, info: `Works automatically, so this rolls its amount: ${a.n}d${args.die}${signedAdd(args.bonus)}${r.fx ? ` ${r.fx}` : ''}` };
            }
            if (!d) return { kind: 'auto', r, entry, args: null, info: `${r.name} works automatically; there is nothing to roll.` };
            const { minDamage, minInjury } = settings().damage;
            const dr = damageRoll(pack, ch, d, { mod: st.mod, vs: vsChar(), minDamage, minInjury });
            return { kind: 'damage', r: d, entry, args: dr.args, info: `Hits automatically, so this rolls its damage: ${dr.info}` };
        }
        return { kind: st.tab, r, entry, ...testRoll(pack, ch, r, { mod: st.mod, dc: st.dc, vs: vsChar(), tab: st.tab }) };
    };

    const view = () => {
        const ch = curChar();
        const keep = (e) => usable(e) && (e.kind === 'manual' || tabs.includes(e.tab));
        return {
            pack, chars, combat, tabs, tab: st.tab, char: ch, defenses: !combat, filter: st.filter, mod: st.mod, vs: st.vs, dc: st.dc,
            dcDefault: defaultDc(pack, st.tab, vsChar()), manual: st.manual, pickIndex: pickIndex(),
            saved: savedRolls().map((e, i) => ({ e, i })).filter(({ e }) => keep(e)),
            recent: recentRolls().map((e, i) => ({ e, i })).filter(({ e }) => keep(e)),
        };
    };

    const popup = new c.Popup('<div class="rd-pop"></div>', c.POPUP_TYPE.CONFIRM, '', { okButton: 'Roll', cancelButton: 'Cancel' });
    const showing = popup.show();
    const root = popup.dlg.querySelector('.rd-pop');

    const updatePreview = () => {
        const cur = current();
        const preview = root.querySelector('.rd-preview');
        const info = root.querySelector('.rd-info');
        if (info) info.textContent = cur?.info || '';
        if (!preview) return;
        if (!cur) { preview.textContent = st.tab === 'custom' ? '' : 'Pick something to roll.'; return; }
        preview.textContent = cur.kind === 'manual' ? previewMulti(cur.args) : cur.args ? previewText(cur.args) : '—';
    };
    const render = () => {
        const active = document.activeElement?.dataset?.f;
        root.innerHTML = bodyHtml(view());
        updatePreview();
        if (active) root.querySelector(`[data-f="${active}"]`)?.focus();
    };
    const renderList = () => {
        const box = root.querySelector('.rd-list');
        if (box) box.innerHTML = listHtml(view());
        updatePreview();
    };

    const roll = () => popup.complete(c.POPUP_RESULT.AFFIRMATIVE);

    root.addEventListener('click', (e) => {
        const step = e.target.closest('[data-step]');
        if (step) {
            const input = step.parentElement.querySelector('input');
            input.value = String(int(input.value) + Number(step.dataset.step));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }
        const el = e.target.closest('[data-act]');
        if (!el) return;
        const i = Number(el.dataset.i);
        switch (el.dataset.act) {
            case 'tab': st.tab = el.dataset.tab; st.filter = ''; st.dc = ''; st.mod = 0; render(); break;
            case 'pick': {
                const r = list()[i];
                if (r) { st.picks[st.tab] = r.name; root.querySelectorAll('.rd-item').forEach(x => x.classList.toggle('rd-on', x === el)); updatePreview(); }
                break;
            }
            case 'addg': {
                const g = st.manual.groups[st.manual.groups.length - 1] || { die: 6 };
                st.manual.groups.push({ n: 1, die: g.die, mod: 0 });
                render();
                break;
            }
            case 'delg': if (st.manual.groups.length > 1) { st.manual.groups.splice(i, 1); render(); } break;
            case 'unsave': e.stopPropagation(); removePreset(i); render(); break;
            case 'saved': if (applyEntry(savedRolls()[i])) render(); break;
            case 'recent': if (applyEntry(recentRolls()[i])) render(); break;
            case 'save': {
                const cur = current();
                if (!cur) break;
                askName(c, cur.entry.label).then((label) => {
                    if (label === null) return;
                    savePreset({ ...cur.entry, label: label || cur.entry.label });
                    render();
                });
                break;
            }
        }
    });
    root.addEventListener('dblclick', (e) => {
        const el = e.target.closest('[data-act="pick"]');
        if (el && list()[Number(el.dataset.i)]) { st.picks[st.tab] = list()[Number(el.dataset.i)].name; roll(); }
    });
    const onField = (e) => {
        const f = e.target.dataset?.f;
        if (!f) return;
        const val = e.target.value;
        const [key, idx] = f.split(':');
        const g = st.manual.groups[Number(idx)];
        switch (key) {
            case 'mname': st.manual.name = val; break;
            case 'gn': if (g) g.n = clampCount(val); break;
            case 'gdie': if (g) g.die = validDie(val) ?? g.die; break;
            case 'gmod': if (g) g.mod = int(val); break;
            case 'cmp': st.manual.cmp = validCmp(val) ?? st.manual.cmp; break;
            case 'target': st.manual.target = val; break;
            case 'mod': st.mod = int(val); break;
            case 'dc': st.dc = val; break;
            case 'filter': st.filter = val; renderList(); return;
            case 'char': if (e.type === 'change') { st.charKey = val; if (st.vs === val) st.vs = ''; render(); } return;
            case 'vs': if (e.type === 'change') { st.vs = val; st.dc = ''; render(); } return;
        }
        updatePreview();
    };
    root.addEventListener('input', onField);
    root.addEventListener('change', onField);
    root.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); e.stopPropagation(); roll(); }
    });

    render();
    setTimeout(() => (root.querySelector('.rd-filter') || root.querySelector('[data-f="mname"]'))?.focus(), 50);

    const result = await showing;
    if (result !== c.POPUP_RESULT.AFFIRMATIVE) return;
    const cur = current();
    if (!cur) return;
    if (cur.kind === 'manual') {
        sendRoll(buildMultiText(cur.args));
        setLast('manual', cur.entry.manual);
        remember('popup', cur.entry);
        return;
    }
    if (!cur.args) { sendRoll(`${curChar().prefix ? `${curChar().prefix} ` : ''}${cur.r.name} (works automatically).`); remember('popup', cur.entry); return; }
    const text = buildRollText(cur.args);
    sendRoll(text);
    remember('popup', cur.entry);
    if (cur.kind === 'attack') offerDamage(cur, text);
}

/** Ask for a preset name (null = cancelled). */
async function askName(c, suggested) {
    const v = typeof c.callGenericPopup === 'function'
        ? await c.callGenericPopup('Preset name', c.POPUP_TYPE.INPUT, suggested)
        : globalThis.prompt?.('Preset name', suggested);
    return typeof v === 'string' ? v.trim() : null;
}

/** After an attack that hits: open next time on its damage, and offer it in one click. */
function offerDamage(cur, text) {
    const ch = sourceCharacters().find(x => x.key === cur.entry.charKey);
    const d = ch && damageFor(ch, cur.r);
    if (!d || !/\((Critical )?Success\b/.test(text)) return;
    const entry = { ...cur.entry, tab: 'damage', name: d.name, mod: 0, label: `${plainName(ch)}: ${d.name}` };
    setLast('popup', entry);
    try {
        globalThis.toastr?.success(`Click to roll ${d.name}.`, 'Hit!', { timeOut: 12000, onclick: () => openRollPopup({ entry }).catch(err => console.error('[RollDice]', err)) });
    } catch { /* no toasts */ }
}
