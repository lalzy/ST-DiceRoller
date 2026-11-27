// Dice beyond "N dice summed": custom faces, pools sized by the value, keeping the best dice, mixed kinds of dice,
// named symbols that cancel each other, and named result levels. Generic mechanics read from the pack only.
//
// Pack keys (all optional; a pack without them rolls as before):
//   dice.faces    [v1, v2, …]  what each face is worth (face 1 first): a number (0 and negatives allowed) or
//                 { symbol: count } (e.g. { "hit": 1, "spark": 1 }). Missing faces count as their own number.
//   dice.pool     formula on {VALUE} (the value rolled with) and {DC}: how many dice are rolled. The value then sizes
//                 the pool instead of being added to the total.
//   dice.keep     how many dice count (the best ones). dice.keepFrom: 'best' (default: highest for `over`, lowest for
//                 `under`) · 'highest' · 'lowest'. Bonus / penalty dice (a roll's `extra`) roll more dice and keep the
//                 same number: the best for a bonus, the worst for a penalty. In a pool, `extra` adds or removes dice.
//   dice.kinds    { name: { die, faces, count } }: a pool of several kinds of dice; `count` is a formula on {VALUE} {DC}.
//   dice.need     formula on {VALUE} {DC}: the total a pool must reach (default: the DC, else checks.normal).
//   symbols       { total: name, cancel: [[a, b], …] }: the symbol whose count is the total; each pair cancels one for
//                 one (what is left of each is the net count, shown in the result's `symbols`).
//   crit.mode 'symbol'  crit.success / crit.failure are symbol names; crit.successAt / failureAt formulas on {DICE}
//                 (the dice rolled): how many of that symbol make it critical (default 1).
//   levels        [{ name, atLeast }]: named results by margin; `atLeast` is a formula on {VALUE} {TARGET}. The first
//                 entry, highest threshold first, whose threshold the margin reaches is the result's `level`.

const FN = { floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs, min: Math.min, max: Math.max };

/** Safe arithmetic with {NAME} variables (numbers, + - * /, brackets, floor ceil round abs min max). null when broken. */
export function evalVars(src, vars = {}) {
    if (src === null || src === undefined || String(src).trim() === '') return null;
    if (typeof src === 'number') return Number.isFinite(src) ? src : null;
    try {
        const V = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k.toUpperCase(), Number(v) || 0]));
        const text = String(src);
        const toks = [];
        const rx = /\s*(?:(\d+(?:\.\d+)?)|\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}|([A-Za-z_]+)|([-+*/(),]))/y;
        let pos = 0;
        while (pos < text.length) {
            if (/^\s*$/.test(text.slice(pos))) break;
            rx.lastIndex = pos;
            const m = rx.exec(text);
            if (!m) return null;
            pos = rx.lastIndex;
            if (m[1] !== undefined) toks.push({ n: Number(m[1]) });
            else if (m[2] !== undefined) { const k = m[2].toUpperCase(); if (!(k in V)) return null; toks.push({ n: V[k] }); }
            else if (m[3] !== undefined) { if (!FN[m[3].toLowerCase()]) return null; toks.push({ f: m[3].toLowerCase() }); }
            else toks.push({ op: m[4] });
        }
        let i = 0;
        const peek = () => toks[i]?.op;
        const atom = () => {
            const t = toks[i++];
            if (!t) throw new Error('end');
            if (t.n !== undefined) return t.n;
            if (t.op === '(') { const v = expr(); if (toks[i++]?.op !== ')') throw new Error(')'); return v; }
            if (t.op === '-') return -atom();
            if (t.op === '+') return atom();
            if (t.f) {
                if (toks[i++]?.op !== '(') throw new Error('(');
                const args = [expr()];
                while (peek() === ',') { i++; args.push(expr()); }
                if (toks[i++]?.op !== ')') throw new Error(')');
                return FN[t.f](...args);
            }
            throw new Error('op');
        };
        const term = () => { let v = atom(); while (peek() === '*' || peek() === '/') { const op = toks[i++].op; const r = atom(); v = op === '*' ? v * r : v / r; } return v; };
        const expr = () => { let v = term(); while (peek() === '+' || peek() === '-') { const op = toks[i++].op; const r = term(); v = op === '+' ? v + r : v - r; } return v; };
        const v = expr();
        if (i < toks.length) return null;
        return Number.isFinite(v) ? v : null;
    } catch { return null; }
}

/** A formula is fine with these variable names ('' = fine). */
export const formulaOk = (src, names) => evalVars(src, Object.fromEntries(names.map(n => [n, 1]))) !== null;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const symKey = (k) => String(k).trim().toLowerCase();

/** A face value, cleaned: a number, or { symbol: count } with lower-case names. null when it reads as neither. */
function faceOf(v) {
    if (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) && !isObj(v)) return Number(v);
    if (!isObj(v)) return null;
    const out = {};
    for (const [k, n] of Object.entries(v)) if (symKey(k) && Number.isFinite(Number(n)) && Number(n) !== 0) out[symKey(k)] = Number(n);
    return out;
}
/** A list of faces for a die of `die` sides (missing / bad entries count as the face's own number). [] = plain. */
function facesOf(list, die) {
    if (!Array.isArray(list) || !list.length) return [];
    return Array.from({ length: die }, (_, i) => { const f = faceOf(list[i]); return f === null ? i + 1 : f; });
}

/** The extended dice keys of a pack, cleaned (normalizePack calls this). */
export function normalizeDiceExtras(src, base) {
    const d = isObj(src.dice) ? src.dice : {};
    const die = (n) => Math.min(1000, Math.max(2, Math.floor(Number(n) || 6)));
    const out = {};
    const count = Math.min(20, Math.max(1, Math.floor(Number(d.count ?? base.dice.count) || base.dice.count)));
    const sides = die(d.die ?? base.dice.die);
    const faces = facesOf(d.faces, sides);
    if (faces.length) out.faces = faces;
    if (d.pool !== undefined && d.pool !== null && String(d.pool).trim() !== '' && formulaOk(d.pool, ['VALUE', 'DC'])) out.pool = String(d.pool).trim();
    if (Number(d.keep) > 0) out.keep = Math.min(100, Math.floor(Number(d.keep)));
    if (['highest', 'lowest'].includes(d.keepFrom)) out.keepFrom = d.keepFrom;
    if (isObj(d.kinds)) {
        const kinds = {};
        for (const [name, k] of Object.entries(d.kinds)) {
            if (!symKey(name) || !isObj(k) || !formulaOk(k.count ?? '0', ['VALUE', 'DC'])) continue;
            const s = die(k.die);
            kinds[symKey(name)] = { die: s, faces: facesOf(k.faces, s), count: String(k.count ?? '0').trim() || '0' };
        }
        if (Object.keys(kinds).length) out.kinds = kinds;
    }
    if (d.need !== undefined && d.need !== null && String(d.need).trim() !== '' && formulaOk(d.need, ['VALUE', 'DC'])) out.need = String(d.need).trim();
    return { count, die: sides, ...out };
}

export function normalizeSymbols(s) {
    const S = isObj(s) ? s : {};
    const cancel = (Array.isArray(S.cancel) ? S.cancel : []).filter(p => Array.isArray(p) && p.length === 2 && symKey(p[0]) && symKey(p[1]) && symKey(p[0]) !== symKey(p[1]))
        .map(p => [symKey(p[0]), symKey(p[1])]);
    return { total: symKey(S.total || ''), cancel };
}

export function normalizeLevels(list) {
    return (Array.isArray(list) ? list : []).filter(x => isObj(x) && String(x.name || '').trim() && formulaOk(x.atLeast ?? '', ['VALUE', 'TARGET']))
        .map(x => ({ name: String(x.name).trim(), atLeast: String(x.atLeast).trim() }));
}

/** Does this pack roll anything but N plain dice summed? */
export const isExtended = (p) => !!(p?.dice && (p.dice.faces?.length || p.dice.pool || p.dice.keep || p.dice.kinds || p.crit?.mode === 'symbol'));
/** Is the value the size of the pool (not a bonus)? */
export const isPool = (p) => !!(p?.dice?.pool || p?.dice?.kinds);

const clampCount = (n) => Math.max(0, Math.min(100, Math.floor(Number(n) || 0)));

/** The dice to roll: [{ kind, die, faces }] and how many count (keep, best | worst | null). */
export function poolSpec(p, value, dc, extra = 0) {
    const vars = { VALUE: Number(value) || 0, DC: Number.isFinite(Number(dc)) ? Number(dc) : p.checks.normal };
    const x = Math.trunc(Number(extra) || 0);
    if (p.dice.kinds) {
        const dice = [];
        let first = true;
        for (const [kind, k] of Object.entries(p.dice.kinds)) {
            const n = clampCount((evalVars(k.count, vars) ?? 0) + (first ? x : 0));
            first = false;
            for (let i = 0; i < n; i++) dice.push({ kind, die: k.die, faces: k.faces });
        }
        return { dice, keep: null, vars };
    }
    const one = { kind: '', die: p.dice.die, faces: p.dice.faces || [] };
    if (p.dice.pool) {
        const n = clampCount((evalVars(p.dice.pool, vars) ?? 0) + x);
        return { dice: Array(n).fill(one), keep: p.dice.keep ? { n: Math.min(n, p.dice.keep), worst: false } : null, vars };
    }
    const keepN = p.dice.keep || p.dice.count;
    const n = p.dice.count + Math.abs(x);
    return { dice: Array(n).fill(one), keep: n > keepN || p.dice.keep ? { n: keepN, worst: x < 0 } : null, vars };
}

/** What one rolled face is worth: a number or { symbol: n }. */
export const valueOf = (spec, face) => (spec.faces?.length ? spec.faces[face - 1] ?? face : face);
/** A face's numeric worth (symbols: the total symbol's count, else the sum of its symbols). */
const numOf = (v, totalSym) => (typeof v === 'number' ? v : totalSym ? Number(v?.[totalSym]) || 0 : Object.values(v || {}).reduce((a, b) => a + b, 0));

/**
 * Read rolled dice of the extended kind. `rolled`: [{ spec, face }]. Returns the fields test() adds to a result:
 * { kept: [i…], values, sum, symbols }.
 */
export function readPool(p, rolled, keep) {
    const S = p.symbols || { total: '', cancel: [] };
    const values = rolled.map(r => valueOf(r.spec, r.face));
    let idx = rolled.map((_, i) => i);
    if (keep && keep.n < rolled.length) {
        const over = p.test === 'over' || isPool(p);
        const from = p.dice.keepFrom || 'best';
        const hi = from === 'highest' || (from === 'best' && over);
        const high = keep.worst ? !hi : hi;
        idx = [...idx].sort((a, b) => (numOf(values[b], S.total) - numOf(values[a], S.total)) * (high ? 1 : -1) || a - b).slice(0, keep.n).sort((a, b) => a - b);
    }
    const symbols = {};
    let sum = 0;
    for (const i of idx) {
        const v = values[i];
        if (typeof v === 'number') { if (S.total) symbols[S.total] = (symbols[S.total] || 0) + v; sum += v; continue; }
        for (const [k, n] of Object.entries(v || {})) symbols[k] = (symbols[k] || 0) + n;
    }
    // opposite symbols cancel one for one
    for (const [a, b] of S.cancel) {
        const n = Math.min(symbols[a] || 0, symbols[b] || 0);
        if (n > 0) { symbols[a] -= n; symbols[b] -= n; }
    }
    if (S.total) sum = symbols[S.total] || 0;
    // a cancelled-away symbol pair shows as its net counts; zeros are dropped
    for (const k of Object.keys(symbols)) if (!symbols[k]) delete symbols[k];
    return { kept: idx, values, sum, symbols };
}

/** The result level for a margin ('' when the pack has none or none is reached). */
export function levelOf(p, margin, value, target) {
    const list = Array.isArray(p.levels) ? p.levels : [];
    if (!list.length) return '';
    const vars = { VALUE: Number(value) || 0, TARGET: Number(target) || 0 };
    const ranked = list.map(x => ({ name: x.name, at: evalVars(x.atLeast, vars) })).filter(x => x.at !== null).sort((a, b) => b.at - a.at);
    return ranked.find(x => margin >= x.at)?.name || '';
}

/** Short text of how a pack rolls: "3d6", "4d3 (faces -1 0 1)", "a pool of d6 (value)", "mixed pool: ability, …". */
export function diceText(p) {
    const d = p?.dice || {};
    if (d.kinds) return `a mixed pool (${Object.keys(d.kinds).join(', ')})`;
    const faces = d.faces?.length ? ` (faces ${d.faces.map(f => (typeof f === 'number' ? f : Object.entries(f).map(([k, n]) => `${n > 1 ? n : ''}${k}`).join('+') || '–')).join(' ')})` : '';
    const keep = d.keep ? `, keep ${d.keep}` : '';
    if (d.pool) return `a pool of d${d.die}${faces} sized by the ${p.labels?.value || 'value'}${keep}`;
    return `${d.count}d${d.die}${faces}${keep}`;
}
