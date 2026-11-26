// One success test for every roll, read through a game system pack.
import { rollDie as cryptoDie } from '../rolls/dice.js';
import { parseTotals } from '../rolls/verdict.js';
import { normalizePack } from './packs.js';
import { evalSkillFormula } from './formula.js';

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
    if (p.crit.mode === 'none') return { success: '', failure: '' };
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
 * @param {{dc?: number, roll?: (sides:number)=>number}} [opts] dc: target number for 'over' (default checks.normal)
 * @returns {{dice:number[], sum:number, value:number, total:number, target:number, test:string, success:boolean,
 *            crit:null|'success'|'failure', margin:number, natural:number}}
 */
export function test(pack, value, opts = {}) {
    const p = pack?.test ? pack : normalizePack(pack);
    const roll = typeof opts.roll === 'function' ? opts.roll : cryptoDie;
    const dice = Array.from({ length: p.dice.count }, () => roll(p.dice.die));
    return read(p, dice, Number(value) || 0, opts.dc);
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

/** "4 + 3 + 2 = 9 vs 12 · success by 3" (under) / "17 + 5 = 22 vs DC 15 · success by 7" (over). */
export function describe(r, pack) {
    const verdict = r.crit ? `critical ${r.crit}` : r.success ? `success by ${r.margin}` : `failure by ${-r.margin}`;
    if (r.test === 'over') {
        const label = pack?.labels?.target || 'DC';
        const math = `${r.dice.join(' + ')}${r.value ? ` ${signed(r.value)}` : ''} = ${r.total}`;
        return `${math} vs ${r.vsLabel || label} ${r.target} · ${verdict}`;
    }
    return `${r.dice.join(' + ')} = ${r.total} vs ${r.target} · ${verdict}`;
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
