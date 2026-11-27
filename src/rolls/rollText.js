import { clampCount, validDie, validCmp, parseTarget } from '../core/validate.js';
import { rollDie, signedAdd } from './dice.js';
import { damageText, moreText } from './damage.js';
import { rollVerdict } from './verdict.js';
import { test as systemTest, describe as systemDescribe } from '../system/resolve.js';
import { diceText } from '../system/pool.js';

const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Roll and build the text inserted into the chat input.
 * @param {{skill?: string, count: number, die: number, cmp?: string, target?: string|number,
 *          bonus?: number,   // added to the dice (meet-or-beat systems: the sheet's bonus)
 *          crit?: {critSuccess?: string, critFail?: string, natural?: boolean},  // natural: lists are die faces of the first die
 *          damage?: {add?: number, type?: string, mult?: number, dr?: number, vs?: string, minDamage?: number, minInjury?: number}}} o
 * @param {number[]} [forced] dice results (for tests)
 */
export function buildRollText(o, forced) {
    // a game system pack with custom faces / pools / kinds: its own roll and reading
    if (o.system?.pack) {
        const q = forced ? [...forced] : null;
        const r = systemTest(o.system.pack, o.system.value, { dc: o.system.dc ?? undefined, roll: q ? (s) => (q.length ? q.shift() : rollDie(s)) : rollDie });
        const verdict = r.crit ? `Critical ${r.crit === 'success' ? 'Success' : 'Failure'}` : r.success ? 'Success' : 'Failure';
        return `${cleanName(o.skill) ? `${cleanName(o.skill)} Roll` : 'Roll'} (${diceText(o.system.pack)}): ${systemDescribe(r, o.system.pack).replace(/ · [^·]*$/, '')} (${verdict}${r.level ? `, ${r.level}` : ''})`;
    }
    const n = o.damage?.flat ? 0 : clampCount(o.count); // flat damage (damage.flat): no dice, the number is the damage
    const d = validDie(o.die) ?? 20;
    const name = cleanName(o.skill);
    // damage may add dice of other sizes (damage.more: [{ n, sides }], e.g. 1d8 + 2d6)
    const more = o.damage && Array.isArray(o.damage.more) ? o.damage.more.filter(m => Number(m.n) > 0 && validDie(Number(m.sides))) : [];
    const extra = more.flatMap(m => Array.from({ length: Math.min(100, Math.floor(Number(m.n))) }, () => rollDie(Number(m.sides))));
    const dice = forced ?? [...Array.from({ length: n }, () => rollDie(d)), ...extra];
    const total = dice.reduce((a, b) => a + b, 0);
    if (o.damage) return damageText(name, n, d, dice, total, o.damage);

    const target = parseTarget(o.target);
    const cmp = validCmp(o.cmp) ?? '>=';
    const bonus = Math.trunc(Number(o.bonus) || 0);
    const grand = total + bonus;
    const label = `${name ? `${name} Roll` : 'Roll'} (${n}d${d}${signedAdd(bonus)}${target !== null ? ` vs ${cmp} ${target}` : ''})`;
    const bonusTxt = bonus ? ` ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}` : '';
    const math = n > 1 || bonus ? `${dice.join(' + ')}${bonusTxt} = ${grand}` : `${grand}`;
    let verdict = '';
    if (target !== null) {
        verdict = ` (${rollVerdict(grand, cmp, target, o.crit, o.crit?.natural ? dice[0] : total)})`;
    }
    return `${label}: ${math}${verdict}`;
}

/** Same shape as buildRollText, without rolling – for the popup preview. */
export function previewText(o) {
    if (o.system?.pack) return `${cleanName(o.skill) ? `${cleanName(o.skill)} Roll` : 'Roll'} (${diceText(o.system.pack)}): …`;
    const n = clampCount(o.count);
    const d = validDie(o.die) ?? 20;
    const name = cleanName(o.skill);
    if (o.damage) {
        const add = Math.trunc(Number(o.damage.add) || 0);
        const vs = String(o.damage.vs || '').trim();
        const dice = o.damage.flat ? `${moreText(o.damage).replace(/^\+/, '')}${moreText(o.damage) ? signedAdd(add) : add}` : `${n}d${d}${moreText(o.damage)}${signedAdd(add)}`;
        return `${name || 'Damage'}${vs ? ` vs ${vs}` : ''} (${dice}${o.damage.type ? ` ${o.damage.type}` : ''}${vs ? `, armor ${o.damage.dr || 0}` : ''}): …`;
    }
    const target = parseTarget(o.target);
    const bonus = Math.trunc(Number(o.bonus) || 0);
    return `${name ? `${name} Roll` : 'Roll'} (${n}d${d}${signedAdd(bonus)}${target !== null ? ` vs ${o.cmp} ${target}` : ''}): …`;
}

/** Valid dice groups: [{ n, die, mod }] (die types from DIE_TYPES, count 1–100, whole modifiers). */
export function cleanGroups(groups) {
    return (Array.isArray(groups) ? groups : []).map(g => ({ n: clampCount(g?.n), die: validDie(g?.die), mod: Math.trunc(Number(g?.mod) || 0) }))
        .filter(g => g.die !== null);
}

const groupLabel = (g) => `${g.n}d${g.die}${signedAdd(g.mod)}`;
const signedTerm = (v) => (v ? ` ${v > 0 ? '+' : '-'} ${Math.abs(v)}` : '');

/**
 * Several dice groups, each with its own modifier, added up and optionally read against a target, e.g.
 *   Attack Roll (3d6+2 + 2d3-1 + 1d20 vs >= 20): (4 + 2 + 6) + 2 + (1 + 3) - 1 + 17 = 34 (Success by 14)
 * One group gives exactly the same text as buildRollText. Critical lists are checked against the dice alone.
 * @param {{skill?: string, groups: {n:number, die:number, mod?:number}[], cmp?: string, target?: string|number,
 *          crit?: {critSuccess?: string, critFail?: string}}} o
 * @param {number[][]} [forced] dice results per group (for tests)
 */
export function buildMultiText(o, forced) {
    const groups = cleanGroups(o.groups);
    if (!groups.length) groups.push({ n: 1, die: 20, mod: 0 });
    if (groups.length === 1) {
        const g = groups[0];
        return buildRollText({ skill: o.skill, count: g.n, die: g.die, cmp: o.cmp, target: o.target, bonus: g.mod, crit: o.crit }, forced?.[0]);
    }
    const name = cleanName(o.skill);
    const rolled = groups.map((g, i) => forced?.[i] ?? Array.from({ length: g.n }, () => rollDie(g.die)));
    const diceSum = rolled.flat().reduce((a, b) => a + b, 0);
    const grand = diceSum + groups.reduce((a, g) => a + g.mod, 0);
    const target = parseTarget(o.target);
    const cmp = validCmp(o.cmp) ?? '>=';
    const label = `${name ? `${name} Roll` : 'Roll'} (${groups.map(groupLabel).join(' + ')}${target !== null ? ` vs ${cmp} ${target}` : ''})`;
    const math = groups.map((g, i) => {
        const d = rolled[i];
        const dice = d.length > 1 ? `(${d.join(' + ')})` : `${d[0]}`;
        return (i ? ' + ' : '') + dice + signedTerm(g.mod);
    }).join('');
    const verdict = target !== null ? ` (${rollVerdict(grand, cmp, target, o.crit, diceSum)})` : '';
    return `${label}: ${math} = ${grand}${verdict}`;
}

/** Preview for buildMultiText, without rolling. */
export function previewMulti(o) {
    const groups = cleanGroups(o.groups);
    const name = cleanName(o.skill);
    const target = parseTarget(o.target);
    const cmp = validCmp(o.cmp) ?? '>=';
    return `${name ? `${name} Roll` : 'Roll'} (${groups.map(groupLabel).join(' + ') || '—'}${target !== null ? ` vs ${cmp} ${target}` : ''}): …`;
}
