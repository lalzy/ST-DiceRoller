import { compare } from './dice.js';

/** Parse a user list of dice totals such as "3-4, 18" into a Set of numbers. Empty → empty Set. */
export function parseTotals(text) {
    const out = new Set();
    for (const part of String(text ?? '').split(',')) {
        const m = part.trim().match(/^(-?\d+)\s*(?:-\s*(-?\d+))?$/);
        if (!m) continue;
        const a = Number(m[1]);
        const b = m[2] !== undefined ? Number(m[2]) : a;
        for (let i = Math.min(a, b); i <= Math.max(a, b) && out.size < 1000; i++) out.add(i);
    }
    return out;
}

/**
 * Generic success check: optional user-defined critical totals, then pass/fail with margin.
 * @param {{critSuccess?: string, critFail?: string}} [crit]
 * @param {number} [critFace] what the critical lists are checked against (the dice sum, or a natural die face)
 */
export function rollVerdict(total, cmp, target, crit = {}, critFace = total) {
    if (parseTotals(crit.critSuccess).has(critFace)) return 'Critical Success';
    if (parseTotals(crit.critFail).has(critFace)) return 'Critical Failure';
    const margin = Math.abs(total - target);
    return compare(total, cmp, target) ? `Success by ${margin}` : `Failure by ${margin}`;
}
