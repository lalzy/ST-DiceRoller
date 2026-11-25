import { clampCount, validDie, validCmp, parseTarget } from '../core/validate.js';
import { rollDie, compare, signedAdd } from './dice.js';
import { damageText } from './damage.js';
import { gurpsVerdict } from './gurps.js';

const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Roll and build the text inserted into the chat input.
 * @param {{skill?: string, count: number, die: number, cmp?: string, target?: string|number, rules?: string,
 *          damage?: {add?: number, type?: string, mult?: number, dr?: number, vs?: string}}} o
 * @param {number[]} [forced] dice results (for tests)
 */
export function buildRollText(o, forced) {
    const n = clampCount(o.count);
    const d = validDie(o.die) ?? 20;
    const name = cleanName(o.skill);
    const dice = forced ?? Array.from({ length: n }, () => rollDie(d));
    const total = dice.reduce((a, b) => a + b, 0);
    if (o.damage) return damageText(name, n, d, dice, total, o.damage);

    const target = parseTarget(o.target);
    const cmp = validCmp(o.cmp) ?? '>=';
    const label = `${name ? `${name} Roll` : 'Roll'} (${n}d${d}${target !== null ? ` vs ${cmp} ${target}` : ''})`;
    const math = n > 1 ? `${dice.join(' + ')} = ${total}` : `${total}`;
    let verdict = '';
    if (target !== null) {
        verdict = o.rules === 'gurps' && n === 3 && d === 6 && cmp === '<='
            ? ` (${gurpsVerdict(total, target)})`
            : ` (${compare(total, cmp, target) ? 'Success' : 'Failure'})`;
    }
    return `${label}: ${math}${verdict}`;
}

/** Same shape as buildRollText, without rolling – for the popup preview. */
export function previewText(o) {
    const n = clampCount(o.count);
    const d = validDie(o.die) ?? 20;
    const name = cleanName(o.skill);
    if (o.damage) {
        const add = Math.trunc(Number(o.damage.add) || 0);
        const vs = String(o.damage.vs || '').trim();
        return `${name || 'Damage'}${vs ? ` vs ${vs}` : ''} (${n}d${d === 6 ? '' : d}${signedAdd(add)}${o.damage.type ? ` ${o.damage.type}` : ''}${vs ? `, DR ${o.damage.dr || 0}` : ''}): …`;
    }
    const target = parseTarget(o.target);
    return `${name ? `${name} Roll` : 'Roll'} (${n}d${d}${target !== null ? ` vs ${o.cmp} ${target}` : ''}): …`;
}
