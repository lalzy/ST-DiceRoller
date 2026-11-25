import { DIE_TYPES, COMPARATORS } from '../core/constants.js';
import { esc } from '../core/html.js';

export function dieOptions(selected) {
    return DIE_TYPES.map(d => `<option value="${d}"${d === Number(selected) ? ' selected' : ''}>d${d}</option>`).join('');
}

export function cmpOptions(selected) {
    return COMPARATORS.map(c => `<option value="${esc(c)}"${c === selected ? ' selected' : ''}>${esc(c)}</option>`).join('');
}

/** <option>s grouped into <optgroup>s by item.group; option value = index in items. */
export function groupedOptions(items, label) {
    const groups = [];
    items.forEach((r, i) => {
        let g = groups.find(x => x.name === (r.group || ''));
        if (!g) groups.push(g = { name: r.group || '', items: [] });
        g.items.push({ r, i });
    });
    return '<option value="">— choose —</option>' + groups.map(g => {
        const opts = g.items.map(({ r, i }) => `<option value="${i}">${esc(label(r))}</option>`).join('');
        return g.name ? `<optgroup label="${esc(g.name)}">${opts}</optgroup>` : opts;
    }).join('');
}
