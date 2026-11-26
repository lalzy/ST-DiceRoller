// The roll popup's building blocks: several dice groups, the default pack, and what each sheet tab lists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMultiText, buildRollText, cleanGroups } from '../src/rolls/rollText.js';
import { GENERIC, DEFAULT_PACK, BUILT_IN, normalizePack } from '../src/system/packs.js';
import { checkList, attackList, damageList, damageFor, testRoll, damageRoll } from '../src/ui/popup/sheetPicker.js';

test('several dice groups, each with its own modifier', () => {
    const o = { skill: 'Attack', groups: [{ n: 3, die: 6, mod: 2 }, { n: 2, die: 3, mod: -1 }, { n: 1, die: 20, mod: 0 }], cmp: '>=', target: '20' };
    assert.equal(buildMultiText(o, [[4, 2, 6], [1, 3], [17]]), 'Attack Roll (3d6+2 + 2d3-1 + 1d20 vs >= 20): (4 + 2 + 6) + 2 + (1 + 3) - 1 + 17 = 34 (Success by 14)');
    assert.equal(buildMultiText({ groups: [{ n: 2, die: 6 }, { n: 1, die: 4 }] }, [[1, 2], [3]]), 'Roll (2d6 + 1d4): (1 + 2) + 3 = 6');
});

test('one dice group reads exactly like a plain roll', () => {
    const one = buildMultiText({ skill: 'P', groups: [{ n: 3, die: 6, mod: 2 }], cmp: '<=', target: '12' }, [[4, 2, 6]]);
    assert.equal(one, buildRollText({ skill: 'P', count: 3, die: 6, cmp: '<=', target: '12', bonus: 2 }, [4, 2, 6]));
    assert.deepEqual(cleanGroups([{ n: 0, die: 7 }, { n: 200, die: 6, mod: 1.7 }]), [{ n: 100, die: 6, mod: 1 }]);
});

test('flat damage rolls no dice', () => {
    const t = buildRollText({ skill: 'Kick Damage', count: 1, die: 6, damage: { add: 3, type: 'cr', flat: true, vs: 'Mira', dr: 1, mult: 1 } });
    assert.equal(t, 'Kick Damage vs Mira (3 cr, armor 1): 3 cr → 2 penetrating = 2 injury');
});

test('the default pack is built in and normalizes to itself', () => {
    assert.equal(DEFAULT_PACK, GENERIC);
    assert.equal(BUILT_IN[0].id, GENERIC.id);
    const p = normalizePack(GENERIC);
    assert.deepEqual(p.dice, { count: 3, die: 6 });
    assert.equal(p.test, 'under');
    assert.deepEqual(p.defense.against.ranged, ['dodge', 'block']);
    assert.ok(p.stats.agility.includes('AGI'));
});

const CH = {
    key: 's:user', name: 'Arin (you)', prefix: '', dr: 0,
    rollables: [{ group: 'Skills', name: 'Stealth', target: 13 }, { group: 'Abilities', name: 'Drink (Potion)', target: 0 }],
    combat: [
        { group: 'Attack', kind: 'roll', name: 'Sword Swing', target: 13, item: 'Sword', use: 'melee', reach: 1 },
        { group: 'Damage', kind: 'damage', name: 'Sword Swing Damage', n: 1, sides: 6, add: 2, type: 'cut', mult: 1.5, item: 'Sword' },
        { group: 'Defense', kind: 'roll', name: 'Parry (Sword)', target: 9, item: 'Sword' },
        { group: 'Abilities', kind: 'roll', name: 'Drink (Potion)', target: 0, attack: true, hits: 'auto', use: 'utility' },
        { group: 'Skills & spells', kind: 'roll', name: 'Stealth', target: 13 },
    ],
};
const MIRA = { key: 's:m', name: 'Mira', dr: 5 };

test('sheet tabs: checks, attacks, damage', () => {
    assert.deepEqual(checkList(CH, true).map(r => r.name), ['Stealth', 'Parry (Sword)']);
    assert.deepEqual(checkList(CH, false).map(r => r.name), ['Stealth']);
    assert.deepEqual(attackList(CH).map(r => r.name), ['Sword Swing', 'Drink (Potion)']);
    assert.deepEqual(damageList(CH).map(r => r.name), ['Sword Swing Damage']);
    assert.equal(damageFor(CH, attackList(CH)[0]).name, 'Sword Swing Damage');
    assert.equal(damageFor(CH, attackList(CH)[1]), null);
});

test('rolls are read through the pack', () => {
    const p = normalizePack(GENERIC);
    const atk = testRoll(p, CH, attackList(CH)[0], { mod: -2, vs: MIRA, tab: 'attack' }).args;
    assert.equal(atk.skill, 'Sword Swing -2 at Mira');
    assert.deepEqual([atk.count, atk.die, atk.cmp, atk.target], [3, 6, '<=', '11']);
    const dmg = damageRoll(p, CH, damageList(CH)[0], { vs: MIRA }).args;
    assert.deepEqual([dmg.damage.dr, dmg.damage.mult, dmg.damage.vs], [5, 1.5, 'Mira']);
    const d20 = normalizePack({ test: 'over', armor: 'class', defense: { model: 'passive', passiveBase: 10 } });
    assert.equal(damageRoll(d20, CH, damageList(CH)[0], { vs: MIRA }).args.damage.dr, 0); // armor class: no soak
    assert.equal(testRoll(d20, CH, attackList(CH)[0], { vs: { ...MIRA, ac: 14 }, tab: 'attack' }).args.target, '14');
});
