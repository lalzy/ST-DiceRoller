// Tiny safe formula: numbers, one variable, + - * /, brackets, floor ceil round abs min max. No eval.
const FN = { floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs, min: Math.min, max: Math.max };

/** Evaluate `src` where the word `name` (or {NAME} in braces) is `value`. Throws on a bad formula. */
export function runFormula(src, value, names = ['score']) {
    const text = String(src).replace(/\{\s*([A-Za-z_]+)\s*\}/g, (a, k) => (names.some(n => n.toLowerCase() === k.toLowerCase()) ? ` ${names[0]} ` : ` ${k} `));
    const toks = text.match(/\s*(\d+(?:\.\d+)?|[A-Za-z_]+|[-+*/(),])/g);
    if (!toks || toks.join('').replace(/\s+/g, '') !== text.replace(/\s+/g, '')) throw new Error('bad formula');
    const t = toks.map(x => x.trim());
    let i = 0;
    const peek = () => t[i];
    const isVar = (x) => names.some(n => n.toLowerCase() === String(x).toLowerCase());
    const atom = () => {
        const x = t[i++];
        if (x === undefined) throw new Error('unexpected end');
        if (x === '(') { const v = expr(); if (t[i++] !== ')') throw new Error('missing )'); return v; }
        if (x === '-') return -atom();
        if (x === '+') return atom();
        if (/^\d/.test(x)) return Number(x);
        if (isVar(x)) return Number(value) || 0;
        if (FN[x] && peek() === '(') {
            i++;
            const args = [expr()];
            while (peek() === ',') { i++; args.push(expr()); }
            if (t[i++] !== ')') throw new Error('missing )');
            return FN[x](...args);
        }
        throw new Error(`unknown name ${x}`);
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
    const v = expr();
    if (i < t.length) throw new Error('unexpected text');
    if (!Number.isFinite(v)) throw new Error('not a number');
    return v;
}

/** A formula on {SKILL} (also {VALUE}) at this value; null when empty or broken. */
export function evalSkillFormula(src, value) {
    if (src === null || src === undefined || String(src).trim() === '') return null;
    try { return runFormula(src, value, ['SKILL', 'VALUE']); } catch { return null; }
}
