import { signedAdd } from './dice.js';

/** Extra dice of other sizes, as text: "+2d6". */
export const moreText = (dmg) => (Array.isArray(dmg?.more) ? dmg.more.filter(m => Number(m.n) > 0).map(m => `+${m.n}d${m.sides}`).join('') : '');

const floorOf = (v) => Math.max(0, Math.trunc(Number(v) || 0));

/**
 * Damage roll, e.g.
 *   Bob's Smithing hammer Damage vs Seraphina (2d+1 cr, armor 2): 4 + 5 + 1 = 10 cr → 8 injury
 * Generic math: total = dice + add; penetrating = total − armor; injury = penetrating × multiplier (rounded down).
 * Optional floors (dmg.minDamage, dmg.minInjury) come from the user's settings and default to 0.
 */
export function damageText(name, n, d, dice, sum, dmg) {
    const add = Math.trunc(Number(dmg.add) || 0);
    const type = String(dmg.type || '').trim();
    const dr = Math.max(0, Math.trunc(Number(dmg.dr) || 0));
    const mult = Number(dmg.mult) || 1;
    const vs = String(dmg.vs || '').trim();
    const total = Math.max(floorOf(dmg.minDamage), sum + add);
    const more = moreText(dmg);
    const diceLabel = `${n > 0 ? `${n}d${d}${more}${signedAdd(add)}` : more ? `${more.slice(1)}${signedAdd(add)}` : `${add}`}${type ? ` ${type}` : ''}`;
    const label = `${name || 'Damage'}${vs ? ` vs ${vs}` : ''} (${diceLabel}${vs ? `, armor ${dr}` : ''})`;
    const sumTxt = !dice.length || (dice.length === 1 && !add) ? '' : `${dice.join(' + ')}${add ? ` ${add > 0 ? '+' : '-'} ${Math.abs(add)}` : ''} = `;
    const math = `${sumTxt}${total}${type ? ` ${type}` : ''}`;
    if (!vs) return `${label}: ${math}`;
    const pen = Math.max(0, total - dr);
    if (pen <= 0) return `${label}: ${math} → no penetration`;
    const injury = Math.max(floorOf(dmg.minInjury), Math.floor(pen * mult));
    const steps = [];
    if (dr > 0) steps.push(`${pen} penetrating`);
    if (mult !== 1) steps.push(steps.length ? `× ${mult}` : `${pen} × ${mult}`);
    const result = `→ ${steps.length ? `${steps.join(' ')} = ` : ''}${injury} injury`;
    return `${label}: ${math} ${result}`;
}
