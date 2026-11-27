// Extended dice in a pack: custom faces, pools sized by the value, kept dice and bonus / penalty dice, mixed kinds of
// dice with symbols that cancel, symbol criticals, and named result levels. All pack data here is made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePack } from '../src/system/packs.js';
import { test as check, describe, chance, critLists } from '../src/system/resolve.js';
import { diceText } from '../src/system/pool.js';

const seq = (...faces) => { const q = [...faces]; return () => { if (!q.length) throw new Error('out of dice'); return q.shift(); }; };

test('faces: four three-sided dice worth -1, 0, +1, plus the bonus, vs the target', () => {
    const p = normalizePack({ test: 'over', dice: { count: 4, die: 3, faces: [-1, 0, 1] }, crit: { mode: 'none' }, checks: { normal: 0 } });
    const r = check(p, 2, { dc: 3, roll: seq(3, 3, 2, 1) }); // +1 +1 0 -1 = 1, + 2 = 3
    assert.equal(r.sum, 1);
    assert.equal(r.total, 3);
    assert.equal(r.success, true);
    assert.equal(r.margin, 0);
    assert.equal(describe(r, p), '3=1 3=1 2=0 1=-1 → 1 + 2 = 3 vs DC 3 · success by 0');
    assert.equal(diceText(p), '4d3 (faces -1 0 1)');
});

test('pool: the value is the number of dice; faces count hits', () => {
    const p = normalizePack({ test: 'over', dice: { die: 6, pool: '{VALUE}', faces: [0, 0, 0, 0, 1, 1] }, crit: { mode: 'none' }, checks: { normal: 1 } });
    assert.equal(p.test, 'over');
    const r = check(p, 5, { dc: 2, roll: seq(6, 5, 1, 2, 3) });
    assert.equal(r.dice.length, 5);
    assert.equal(r.total, 2);
    assert.equal(r.success, true);
    assert.equal(r.margin, 0);
    // bonus / penalty dice change the pool size
    assert.equal(check(p, 5, { dc: 2, extra: 2, roll: seq(1, 1, 1, 1, 1, 1, 1) }).dice.length, 7);
    assert.equal(check(p, 1, { dc: 2, extra: -3, roll: seq() }).dice.length, 0);
    assert.ok(chance(p, 6, 2) > 0.5 && chance(p, 6, 2) < 0.8);
});

test('keep: bonus dice keep the best, penalty dice the worst (best = high for over, low for under)', () => {
    const over = normalizePack({ test: 'over', dice: { count: 1, die: 20 }, crit: { mode: 'natural', success: '20', failure: '1' } });
    assert.equal(check(over, 0, { dc: 10, extra: 1, roll: seq(4, 17) }).total, 17);
    assert.equal(check(over, 0, { dc: 10, extra: -1, roll: seq(4, 17) }).total, 4);
    assert.equal(check(over, 0, { dc: 10, extra: 1, roll: seq(20, 3) }).crit, 'success');
    const under = normalizePack({ test: 'under', dice: { count: 1, die: 100 }, crit: { mode: 'none' } });
    assert.equal(check(under, 50, { extra: 1, roll: seq(80, 30) }).total, 30);
    assert.equal(check(under, 50, { extra: -1, roll: seq(80, 30) }).total, 80);
    // a pack that always keeps some of its dice
    const three = normalizePack({ test: 'over', dice: { count: 4, die: 6, keep: 3 }, crit: { mode: 'none' } });
    const r = check(three, 0, { dc: 10, roll: seq(1, 6, 4, 5) });
    assert.equal(r.total, 15);
    assert.match(describe(r, three), /^\(1\) 6 4 5 → 15/);
});

test('mixed pool: kinds of dice sized by the value and the DC, symbols cancel, symbol criticals', () => {
    const plus = [{}, { hit: 1 }, { hit: 1 }, { boon: 1 }, { hit: 1, boon: 1 }, { star: 1, hit: 1 }];
    const minus = [{}, { miss: 1 }, { miss: 1 }, { bane: 1 }, { miss: 1, bane: 1 }, { doom: 1, miss: 1 }];
    const p = normalizePack({
        test: 'over',
        dice: { need: '1', kinds: { good: { die: 6, faces: plus, count: '{VALUE}' }, bad: { die: 6, faces: minus, count: '{DC}' } } },
        symbols: { total: 'hit', cancel: [['hit', 'miss'], ['boon', 'bane']] },
        crit: { mode: 'symbol', success: 'star', failure: 'doom' },
    });
    const r = check(p, 3, { dc: 2, roll: seq(2, 5, 6, 2, 4) }); // good: hit, hit+boon, star+hit · bad: miss, bane
    assert.deepEqual(r.kinds, ['good', 'good', 'good', 'bad', 'bad']);
    assert.deepEqual(r.symbols, { hit: 2, star: 1 });
    assert.equal(r.total, 2);
    assert.equal(r.crit, 'success');
    assert.equal(r.margin, 1);
    assert.match(describe(r, p), /good:2=hit good:5=hit\+boon good:6=star\+hit bad:2=miss bad:4=bane → 2 \[2 hit, 1 star\] vs DC 1 · critical success/);
    assert.deepEqual(critLists(p, 3), { success: '', failure: '' });
    const fail = check(p, 1, { dc: 1, roll: seq(2, 2) }); // hit vs miss: 0
    assert.equal(fail.total, 0);
    assert.equal(fail.success, false);
});

test('levels: named results by margin, best first', () => {
    const p = normalizePack({ test: 'under', dice: { count: 1, die: 100 }, crit: { mode: 'none' }, levels: [{ name: 'hard', atLeast: '{VALUE} - floor({VALUE} / 2)' }, { name: 'extreme', atLeast: '{VALUE} - floor({VALUE} / 5)' }, { name: 'regular', atLeast: '0' }] });
    assert.equal(check(p, 60, { roll: seq(50) }).level, 'regular');
    assert.equal(check(p, 60, { roll: seq(30) }).level, 'hard');
    assert.equal(check(p, 60, { roll: seq(12) }).level, 'extreme');
    assert.equal(check(p, 60, { roll: seq(70) }).level, undefined);
    assert.match(describe(check(p, 60, { roll: seq(30) }), p), /success by 30 \(hard\)/);
});

test('plain packs roll exactly as before', () => {
    const p = normalizePack({ test: 'under', dice: { count: 3, die: 6 } });
    assert.deepEqual(p.dice, { count: 3, die: 6 });
    const r = check(p, 12, { roll: seq(4, 3, 2) });
    assert.equal(r.extended, undefined);
    assert.equal(describe(r, p), '4 + 3 + 2 = 9 vs 12 · success by 3');
});

import { testRoll } from '../src/ui/popup/sheetPicker.js';
import { buildRollText } from '../src/rolls/rollText.js';

test('sheet rolls from the popup use the pack\'s own dice when it has extended dice', () => {
    const p = normalizePack({ test: 'over', dice: { die: 6, pool: '{VALUE}', faces: [0, 0, 0, 0, 1, 1] }, crit: { mode: 'none' }, checks: { normal: 1 } });
    const { args } = testRoll(p, { prefix: '' }, { name: 'Sneak', target: 4 }, { dc: 2 });
    assert.ok(args.system);
    assert.equal(buildRollText(args, [6, 6, 1, 2]), 'Sneak Roll (a pool of d6 (faces 0 0 0 0 1 1) sized by the bonus): 6=1 6=1 1=0 2=0 → 2 vs DC 2 (Success)');
});
