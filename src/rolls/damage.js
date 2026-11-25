import { signedAdd } from './dice.js';

/**
 * Damage roll, e.g.
 *   Bob's Smithing hammer Damage vs Seraphina (2d+1 cr, DR 2): 4 + 5 + 1 = 10 cr → 8 injury
 * GURPS: minimum 1 damage (0 for crushing); penetrating = damage − DR; injury = penetrating × wound multiplier (rounded down, at least 1 if it penetrates).
 */
export function damageText(name, n, d, dice, sum, dmg) {
    const add = Math.trunc(Number(dmg.add) || 0);
    const type = String(dmg.type || '').trim();
    const dr = Math.max(0, Math.trunc(Number(dmg.dr) || 0));
    const mult = Number(dmg.mult) || 1;
    const vs = String(dmg.vs || '').trim();
    const minDmg = type === 'cr' ? 0 : 1;
    const total = Math.max(minDmg, sum + add);
    const diceLabel = `${n}d${d === 6 ? '' : d}${signedAdd(add)}${type ? ` ${type}` : ''}`;
    const label = `${name || 'Damage'}${vs ? ` vs ${vs}` : ''} (${diceLabel}${vs ? `, DR ${dr}` : ''})`;
    const sumTxt = dice.length === 1 && !add ? '' : `${dice.join(' + ')}${add ? ` ${add > 0 ? '+' : '-'} ${Math.abs(add)}` : ''} = `;
    const math = `${sumTxt}${total}${type ? ` ${type}` : ''}`;
    if (!vs) return `${label}: ${math}`;
    const pen = Math.max(0, total - dr);
    if (pen <= 0) return `${label}: ${math} → no penetration`;
    const injury = Math.max(1, Math.floor(pen * mult));
    const steps = [];
    if (dr > 0) steps.push(`${pen} penetrating`);
    if (mult !== 1) steps.push(steps.length ? `× ${mult}` : `${pen} × ${mult}`);
    const result = `→ ${steps.length ? `${steps.join(' ')} = ` : ''}${injury} injury`;
    return `${label}: ${math} ${result}`;
}
