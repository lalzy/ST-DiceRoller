function cryptoRandom() {
    return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** Unbiased integer in [1, sides]. */
export function rollDie(sides, rand = cryptoRandom) {
    if (sides <= 1) return 1;
    const limit = Math.floor(0x100000000 / sides) * sides;
    let x;
    do { x = rand(); } while (x >= limit);
    return (x % sides) + 1;
}

export function compare(total, cmp, target) {
    switch (cmp) {
        case '>': return total > target;
        case '>=': return total >= target;
        case '<': return total < target;
        case '<=': return total <= target;
    }
    return false;
}

/** "+2" / "-1" / "" for zero. */
export function signedAdd(a) { return a ? (a > 0 ? `+${a}` : `${a}`) : ''; }
