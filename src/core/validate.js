import { DIE_TYPES, COMPARATORS } from './constants.js';

export function clampCount(v) {
    return Math.min(100, Math.max(1, Math.floor(Number(v) || 1)));
}

export function validDie(v) {
    return DIE_TYPES.includes(Number(v)) ? Number(v) : null;
}

export function validCmp(v) {
    return COMPARATORS.includes(v) ? v : null;
}

/** Parse the versus target; '' / invalid → null (no versus). */
export function parseTarget(v) {
    const t = String(v ?? '').trim();
    if (!/^-?\d+$/.test(t)) return null;
    return Number(t);
}
