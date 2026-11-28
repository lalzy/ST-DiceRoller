// One success test for every roll, read through a game system pack.
import { rollDie as cryptoDie } from '../rolls/dice.js';
import { parseTotals } from '../rolls/verdict.js';
import { normalizePack } from './packs.js';
import { evalSkillFormula } from './formula.js';
import { isExtended, isPool, poolSpec, readPool, levelOf, evalVars, diceText, spendable } from './pool.js';

export { diceText };

/** The pack's skill-based critical bounds for a roll with `value` ({SKILL}); null where the pack sets none. */
export function critBounds(p, value) {
    const sm = evalSkillFormula(p.crit?.successMax, value);
    const fm = evalSkillFormula(p.crit?.failureMin, value);
    return { successMax: sm === null ? null : Math.floor(sm), failureMin: fm === null ? null : Math.ceil(fm) };
}

/**
 * The pack's critical totals for a roll with `value`, as list text ("3-4, 18"): the lists plus the skill-based bounds.
 * For screens that show or check the lists themselves (the roll popup).
 */
export function critLists(pack, value) {
    const p = pack?.test ? pack : normalizePack(pack);
    if (p.crit.mode === 'none' || p.crit.mode === 'symbol' || isPool(p)) return { success: '', failure: '' };
    const lo = p.crit.mode === 'natural' ? 1 : p.dice.count;
    const hi = p.crit.mode === 'natural' ? p.dice.die : p.dice.count * p.dice.die;
    const { successMax, failureMin } = critBounds(p, value);
    const join = (...xs) => xs.filter(Boolean).join(', ');
    return {
        success: join(p.crit.success, successMax !== null && successMax >= lo ? `${lo}-${Math.min(hi, successMax)}` : ''),
        failure: join(p.crit.failure, failureMin !== null && failureMin <= hi ? `${Math.max(lo, failureMin)}-${hi}` : ''),
    };
}

const sum = (a) => a.reduce((x, y) => x + y, 0);

/**
 * Roll a check.
 * @param {object} pack a normalized pack
 * @param {number} value the skill / attribute (test 'under') or the bonus (test 'over'), modifiers included
 * @param {{dc?: number, roll?: (sides:number)=>number, extra?: number|object, vars?: object, kinds?: object, pool?: object}} [opts]
 *   dc: target number for 'over' (default checks.normal) · extra: bonus / penalty dice (or { kind: ±n }) · vars: the pack's
 *   dice.vars values ({ CHAR: 3, SKILL: 2 }) · kinds: a modifier per die kind ({ boost: 1, setback: 2 }) · pool: counts
 *   per kind given outright
 * @returns {{dice:number[], sum:number, value:number, total:number, target:number, test:string, success:boolean,
 *            crit:null|'success'|'failure', margin:number, natural:number}}
 */
export function test(pack, value, opts = {}) {
    const p = pack?.test ? pack : normalizePack(pack);
    const roll = typeof opts.roll === 'function' ? opts.roll : cryptoDie;
    // custom faces, pools, kept dice, mixed kinds, bonus / penalty dice (opts.extra: + more dice keep the best, − the worst)
    if (isExtended(p) || Number(opts.extra) || (opts.extra && typeof opts.extra === 'object')) {
        const spec = poolSpec(p, Number(value) || 0, opts.dc, opts.extra, { vars: opts.vars, kinds: opts.kinds, pool: opts.pool });
        const rolled = spec.dice.map(d => ({ spec: d, face: roll(d.die) }));
        return readExtended(p, rolled, spec, Number(value) || 0, opts.dc);
    }
    const dice = Array.from({ length: p.dice.count }, () => roll(p.dice.die));
    return withLevel(p, read(p, dice, Number(value) || 0, opts.dc));
}

/** The pack's result level ('' when none) added to a result. */
function withLevel(p, r) {
    const level = levelOf(p, r.margin, r.value, r.target);
    return level ? { ...r, level } : r;
}

/**
 * Read dice rolled the extended way: `rolled` = [{ spec, face }] (spec: { kind, die, faces }), `spec` from poolSpec.
 * Pools are "meet or beat": the total is the dice's worth alone (the value sized the pool); otherwise the value is
 * added (over) or the total must stay at or under it (under), as with plain dice.
 */
export function readExtended(p, rolled, spec, value, dc) {
    const R = readPool(p, rolled, spec.keep);
    const pool = isPool(p);
    const over = pool || p.test === 'over';
    const total = pool ? R.sum : over ? R.sum + value : R.sum;
    const dcNum = Number.isFinite(Number(dc)) ? Number(dc) : p.checks.normal;
    const target = pool ? (p.dice.need ? Math.round(evalVars(p.dice.need, { VALUE: value, DC: dcNum }) ?? dcNum) : dcNum) : over ? dcNum : value;
    let crit = null;
    const keptFaces = R.kept.map(i => rolled[i].face);
    if (p.crit.mode === 'symbol') {
        const at = (f) => Math.max(1, Math.round(evalVars(f || '1', { DICE: rolled.length }) ?? 1));
        const sy = p.crit.success && (R.symbols[String(p.crit.success).toLowerCase()] || 0) >= at(p.crit.successAt);
        const fy = p.crit.failure && (R.symbols[String(p.crit.failure).toLowerCase()] || countRaw(rolled, R, p.crit.failure)) >= at(p.crit.failureAt);
        crit = sy ? 'success' : fy ? 'failure' : null;
    } else if (p.crit.mode !== 'none' && !pool) {
        const face = p.crit.mode === 'natural' ? keptFaces[0] : R.sum;
        const { successMax, failureMin } = critBounds(p, value);
        if (parseTotals(p.crit.success).has(face) || (successMax !== null && face <= successMax)) crit = 'success';
        else if (parseTotals(p.crit.failure).has(face) || (failureMin !== null && face >= failureMin)) crit = 'failure';
    }
    const passes = over ? total >= target : total <= target;
    const margin = over ? total - target : target - total;
    const out = {
        dice: rolled.map(r => r.face), sum: R.sum, value, total, target, test: over ? 'over' : 'under',
        success: crit ? crit === 'success' : passes, crit, margin, natural: keptFaces[0] ?? 0,
        extended: true, pool, kept: R.kept, kinds: rolled.map(r => r.spec.kind), worth: R.values, symbols: R.symbols,
    };
    // what the left-over symbols can buy (pack.spend): the game decides what is bought
    const buy = spendable(p, R.symbols);
    if (buy.length) out.spendable = buy;
    return withLevel(p, out);
}

/** A crit symbol that cancelling removed still counts when the pack's own symbol list doesn't net it (raw count). */
function countRaw(rolled, R, sym) {
    const k = String(sym).toLowerCase();
    return R.kept.reduce((n, i) => { const v = R.values[i]; return n + (v && typeof v === 'object' ? Number(v[k]) || 0 : 0); }, 0);
}

/** Read already-rolled dice (also used by tests). */
export function read(p, dice, value, dc) {
    const s = sum(dice);
    const over = p.test === 'over';
    const total = over ? s + value : s;
    const target = over ? (Number.isFinite(Number(dc)) ? Number(dc) : p.checks.normal) : value;
    let crit = null;
    const face = p.crit.mode === 'natural' ? dice[0] : s;
    if (p.crit.mode !== 'none') {
        const { successMax, failureMin } = critBounds(p, value);
        if (parseTotals(p.crit.success).has(face) || (successMax !== null && face <= successMax)) crit = 'success';
        else if (parseTotals(p.crit.failure).has(face) || (failureMin !== null && face >= failureMin)) crit = 'failure';
    }
    const passes = over ? total >= target : total <= target;
    const margin = over ? total - target : target - total;
    return { dice, sum: s, value, total, target, test: p.test, success: crit ? crit === 'success' : passes, crit, margin, natural: dice[0] };
}

const signed = (n) => (n >= 0 ? `+ ${n}` : `- ${-n}`);

/** A named part of a value: "+ 2 (aim)", "- 4 (lying down)"; the first one unsigned: "10 (Punch)". */
const partText = (x, first) => `${first ? `${x.n}` : signed(x.n)}${x.label ? ` (${x.label})` : ''}`;
/** "10 (Punch) - 4 (lying down) = 6": what a value is made of (r.parts / r.dcParts: [{ label, n }]). */
const partsMath = (list, total) => `${list.map((x, i) => partText(x, i === 0)).join(' ')} = ${total}`;
/** The bonus in an "over" roll: "+ 3 (Sword) + 2 (aim)", or "+ 5". */
const bonusMath = (r) => (r.parts?.length ? ` ${r.parts.map(x => partText(x, false)).join(' ')}` : r.value ? ` ${signed(r.value)}` : '');
/** The number to reach, with its parts when it has them. */
const targetMath = (r) => (r.dcParts?.length ? `${partsMath(r.dcParts, r.target)}` : `${r.target}`);

/**
 * "4 + 3 + 2 = 9 vs 12 · success by 3" (under) / "17 + 5 = 22 vs DC 15 · success by 7" (over). A result with
 * `parts` ([{ label, n }]: what its value is made of) shows every one: "6 + 1 + 1 = 8 vs 10 (Punch) - 4 (lying down)
 * = 6 · failure by 2"; `dcParts` the same for a fixed target number.
 */
export function describe(r, pack) {
    const verdict = (r.crit ? `critical ${r.crit}` : r.success ? `success by ${r.margin}` : `failure by ${-r.margin}`) + (r.level ? ` (${r.level})` : '');
    if (r.extended) {
        // each die as rolled (dropped ones in brackets), what they are worth, then the total
        const show = (v) => (typeof v === 'number' ? `${v}` : Object.entries(v || {}).map(([k, n]) => `${n > 1 ? `${n} ` : ''}${k}`).join('+') || '–');
        const custom = r.worth.some((v, i) => typeof v !== 'number' || v !== r.dice[i]);
        const bits = r.dice.map((f, i) => {
            const t = `${r.kinds[i] ? `${r.kinds[i]}:` : ''}${f}${custom ? `=${show(r.worth[i])}` : ''}`;
            return r.kept.includes(i) ? t : `(${t})`;
        });
        const sym = Object.keys(r.symbols || {}).length && (pack?.symbols?.cancel?.length || Object.keys(r.symbols).length > 1) ? ` [${Object.entries(r.symbols).map(([k, n]) => `${n} ${k}`).join(', ')}]` : '';
        const math = r.pool ? `${r.total}` : r.test === 'over' ? `${r.sum}${bonusMath(r)} = ${r.total}` : `${r.total}`;
        const label = r.test === 'over' ? (r.vsLabel || pack?.labels?.target || 'DC') : '';
        // a pool is sized by its value: show what the value is made of
        const sized = r.pool && r.parts?.length ? ` (pool from ${partsMath(r.parts, r.value)})` : '';
        const target = !r.pool && r.test !== 'over' && r.parts?.length ? partsMath(r.parts, r.target) : targetMath(r);
        return `${bits.join(' ')} → ${math}${sym} vs ${label ? `${label} ` : ''}${target}${sized} · ${verdict}`;
    }
    if (r.test === 'over') {
        const label = pack?.labels?.target || 'DC';
        const math = `${r.dice.join(' + ')}${bonusMath(r)} = ${r.total}`;
        return `${math} vs ${r.vsLabel || label} ${targetMath(r)} · ${verdict}`;
    }
    // roll under: the number to roll under is the value, made of its parts
    return `${r.dice.join(' + ')} = ${r.total} vs ${r.parts?.length ? partsMath(r.parts, r.target) : r.target} · ${verdict}`;
}

/** Distribution of the sum of `count` dice with `die` sides: Map sum → probability. */
function sumDist(count, die) {
    let dist = new Map([[0, 1]]);
    for (let i = 0; i < count; i++) {
        const next = new Map();
        for (const [s, p] of dist) for (let f = 1; f <= die; f++) next.set(s + f, (next.get(s + f) || 0) + p / die);
        dist = next;
    }
    return dist;
}
const cache = new Map();

/** Exact chance that a check succeeds (criticals included). */
export function chance(pack, value, dc) {
    const p = pack?.test ? pack : normalizePack(pack);
    if (isExtended(p)) return sampledChance(p, value, dc);
    const key = `${p.dice.count}d${p.dice.die}`;
    if (!cache.has(key)) cache.set(key, sumDist(p.dice.count, p.dice.die));
    if (p.crit.mode === 'natural') {
        // single die: every face equally likely
        let ok = 0;
        for (let f = 1; f <= p.dice.die; f++) if (read(p, [f], Number(value) || 0, dc).success) ok++;
        return ok / p.dice.die;
    }
    let ok = 0;
    for (const [s, pr] of cache.get(key)) {
        // the sum is what matters; spread it over the first die so read() sees the right total
        if (read(p, [s], Number(value) || 0, dc).success) ok += pr;
    }
    return ok;
}

/** Chance of an extended roll, by sampling (exact sums aren't practical with symbols, kept dice and mixed kinds). */
const sampleCache = new Map();
function sampledChance(p, value, dc) {
    const key = JSON.stringify([p.dice, p.symbols, p.crit, p.test, Number(value) || 0, dc ?? null]);
    if (sampleCache.has(key)) return sampleCache.get(key);
    let seed = 12345;
    const rnd = (sides) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return 1 + (seed % sides); };
    const N = 2000;
    let ok = 0;
    for (let i = 0; i < N; i++) if (test(p, value, { dc, roll: rnd }).success) ok++;
    const v = ok / N;
    if (sampleCache.size > 500) sampleCache.clear();
    sampleCache.set(key, v);
    return v;
}

// ── stat modifiers ─────────────────────────────────────────────────────

/** Tiny safe formula: numbers, `score`, + - * /, brackets, floor ceil round abs min max. */
export function evalStatMod(formula, score) {
    const src = String(formula || 'score');
    if (src.trim() === 'score') return Number(score) || 0;
    const toks = src.match(/\s*(\d+(?:\.\d+)?|[A-Za-z_]+|[-+*/(),])/g);
    if (!toks || toks.join('').replace(/\s+/g, '') !== src.replace(/\s+/g, '')) return Number(score) || 0;
    let i = 0;
    const t = toks.map(x => x.trim());
    const peek = () => t[i];
    const FN = { floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs, min: Math.min, max: Math.max };
    const atom = () => {
        const x = t[i++];
        if (x === '(') { const v = expr(); i++; return v; }
        if (x === '-') return -atom();
        if (x === '+') return atom();
        if (/^\d/.test(x)) return Number(x);
        if (x === 'score') return Number(score) || 0;
        if (FN[x] && peek() === '(') {
            i++;
            const args = [expr()];
            while (peek() === ',') { i++; args.push(expr()); }
            i++;
            return FN[x](...args);
        }
        throw new Error(`bad token ${x}`);
    };
    const term = () => {
        let v = atom();
        while (peek() === '*' || peek() === '/') { const op = t[i++]; const r = atom(); v = op === '*' ? v * r : v / r; }
        return v;
    };
    const expr = () => {
        let v = term();
        while (peek() === '+' || peek() === '-') { const op = t[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
        return v;
    };
    try {
        const v = expr();
        return Number.isFinite(v) ? v : Number(score) || 0;
    } catch { return Number(score) || 0; }
}

/** The number a pack rolls with for an attribute score (e.g. 14 → +2 in a d20 pack, 14 in a 3d6 pack). */
export function statMod(pack, score) {
    const p = pack?.test ? pack : normalizePack(pack);
    return evalStatMod(p.statMod, score);
}

/** Find a stat role's score in an attribute map, by any of the pack's names for it (or the role name itself). */
export function statScore(pack, attrs, role) {
    const p = pack?.test ? pack : normalizePack(pack);
    const a = attrs || {};
    const names = [role, ...(p.stats[role] || [])].map(x => String(x).toLowerCase());
    const key = Object.keys(a).find(k => names.includes(k.toLowerCase()));
    return key !== undefined && Number.isFinite(Number(a[key])) ? Number(a[key]) : null;
}

/** Which role an attribute name belongs to ('' when none). */
export function statRole(pack, name) {
    const p = pack?.test ? pack : normalizePack(pack);
    const n = String(name || '').toLowerCase();
    for (const [role, names] of Object.entries(p.stats)) if (role === n || names.some(x => x.toLowerCase() === n)) return role;
    return '';
}
