import { esc } from '../../core/html.js';
import { signedAdd } from '../../rolls/dice.js';
import { groupedOptions } from '../options.js';

/**
 * "From sheet" picker: Skill mode lists rollables, Combat mode lists attacks / damage / defenses / skills & spells.
 * Mutates `state`; `ui.picked` is shared with the popup so manual name edits can drop the pick.
 * @returns {{ refresh(): void, applyPick(): void }}
 */
export function setupSheetPicker({ el, state, ui, chars, prefill, render }) {
    const currentChar = () => chars.find(ch => ch.key === el.char?.value);
    const listFor = (ch) => (state.preset === 'combat' ? ch?.combat : ch?.rollables) || [];

    const fillList = () => {
        if (!el.roll) return;
        el.roll.innerHTML = groupedOptions(listFor(currentChar()), r => (r.kind === 'damage'
            ? `${r.name} — ${r.n}d${signedAdd(r.add)} ${r.type || ''}`.trim()
            : `${r.name} — ${r.target}${r.note ? ` (${r.note})` : ''}`));
    };

    const fillTargets = () => {
        if (!el.vs) return;
        const me = currentChar();
        const others = chars.filter(ch => ch.key !== me?.key);
        el.vs.innerHTML = '<option value="">— no target —</option>' + others.map(ch => `<option value="${esc(ch.key)}">${esc(ch.name)} (DR ${Number(ch.dr) || 0})</option>`).join('');
    };

    const setInfo = (txt) => { if (el.info) el.info.textContent = txt; };

    const applyDamage = (ch, r, mod, prefix) => {
        const vs = chars.find(x => x.key === el.vs?.value);
        state.count = r.n; state.die = 6; state.target = '';
        state.damage = { add: (r.add || 0) + mod, type: r.type, mult: r.mult ?? 1, dr: vs ? Number(vs.dr) || 0 : 0, vs: vs ? vs.name.replace(/ \(you\)$/, '') : '' };
        state.rules = ch.rules || null;
        state.skill = `${prefix}${r.name}`;
        setInfo(`${r.n}d${signedAdd((r.add || 0) + mod)} ${r.type || ''}${vs ? ` vs DR ${state.damage.dr}` : ''}`);
    };

    const applySkill = (ch, r, mod, prefix) => {
        const modTxt = mod ? ` ${mod > 0 ? '+' : ''}${mod}` : '';
        state.damage = null;
        state.count = 3; state.die = 6; state.cmp = '<=';
        state.rules = ch.rules || null;
        state.skill = `${prefix}${r.name}${modTxt}`;
        state.target = String(Number(r.target) + mod);
        setInfo(`${r.name} ${r.target}${mod ? `${modTxt} = ${state.target}` : ''}`);
    };

    const applyPick = () => {
        const ch = currentChar();
        const r = listFor(ch)[Number(el.roll.value)];
        ui.picked = r && el.roll.value !== '' ? { ch, r } : null;
        if (el.vsRow) el.vsRow.style.display = ui.picked?.r.kind === 'damage' ? '' : 'none';
        if (!ui.picked) { state.damage = null; setInfo(''); render(); return; }
        const mod = Math.trunc(Number(el.mod.value) || 0);
        const prefix = ch.prefix ? `${ch.prefix} ` : '';
        if (r.kind === 'damage') applyDamage(ch, r, mod, prefix);
        else applySkill(ch, r, mod, prefix);
        render();
    };

    /** Called when the preset (Skill/Combat) changes. */
    const refresh = () => {
        if (!el.char) return;
        fillList();
        setInfo('');
        if (el.vsRow) el.vsRow.style.display = 'none';
    };

    if (el.char) {
        const want = prefill.character ? chars.find(ch => ch.key.endsWith(`:${prefill.character}`)) : null;
        if (want) el.char.value = want.key;
        fillList();
        fillTargets();
        if (prefill.rollable) {
            const idx = listFor(currentChar()).findIndex(r => r.name === prefill.rollable);
            if (idx >= 0) el.roll.value = String(idx);
        }
        el.char.addEventListener('change', () => { fillList(); fillTargets(); applyPick(); });
        el.roll.addEventListener('change', applyPick);
        el.vs?.addEventListener('change', applyPick);
        el.mod.addEventListener('input', applyPick);
    }

    return { refresh, applyPick };
}
