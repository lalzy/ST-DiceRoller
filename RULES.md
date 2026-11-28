# Rules in Roll Dice

Roll Dice holds two kinds of rule data:

1. **Settings** for rolling by hand (Extensions → Roll Dice): dice per preset, critical totals, damage floors.
2. **Game system packs** (Extensions → Roll Dice → Game system). They set how every roll made from a character sheet, and by Combat Mode, is rolled and read.

This file describes exactly what the code reads (`src/system/packs.js`, `src/system/resolve.js`, `src/system/pool.js`, `src/core/constants.js`).

---

## 1. Settings for rolling by hand

These are set per preset (**Skill** and **Combat**). Only the **Skill** preset is read. **Custom dice** starts from its dice and comparison until you have rolled once, then opens on the dice you used last; its critical totals are always checked. The **Combat** preset is stored but no roll uses it. Each line of dice has its own modifier, and the critical totals are checked against the dice alone.

| Setting | Default | Meaning |
|---|---|---|
| Number of dice, die type | Skill: 3d6 · Combat: 1d20 | Die types: 1, 2, 3, 4, 6, 8, 10, 12, 20, 100. Count: 1–100. |
| Comparison | Skill `<=` · Combat `>=` | `>`, `>=`, `<`, `<=` against the Versus number. |
| Critical success / failure totals | empty | Lists like `3-4` or `17-18`, separated by commas. They are checked before the comparison. |
| Minimum damage | empty (0) | The lowest a damage roll totals, before armor. Hand and sheet damage rolls. |
| Minimum injury | empty (0) | The lowest injury once damage gets through armor. Hand and sheet damage rolls. |

Rolls made **from a sheet** use the chat's game system pack instead of the dice, comparison and critical settings. Minimum damage and Minimum injury still apply to them. Damage dice keep their own die size.

---

## 2. Game system packs

There are three built-in packs: **Generic (default)** (`generic-default`), **Classic 3d6** (`classic-3d6`) and **Generic d20** (`generic-d20`). Generic (default) is made to match the character sheet's *Generic (default)* rule set: 3d6 rolled at or under the value, criticals on totals 3-4 and 17-18, Dodge / Parry / Block as active defenses (Parry only against melee), armor that soaks damage, the sheet's wound multipliers, and the sheet's attribute names (Body, Agility, Mind, Spirit) under `stats`. New installs start with it; settings that already chose a pack keep it. You choose a default pack for new chats and an optional pack for the open chat. A fight in Combat Mode keeps the pack it started with.

### Making a custom pack

1. In **Rules templates**, pick the built-in pack closest to your game and click **Duplicate to edit** (or the duplicate icon). Give it a name.
2. Change what you need in the box.
3. Click **Save**. It is now the default for new chats; **This chat uses** picks a pack for the open chat only.

When a pack is read:
- Its `id` and `name` come from the template (the name you gave it); `id` and `name` written in the JSON are ignored.
- **Missing keys come from a base pack.** The base is Generic d20 if `test` is `"over"` or `"base": "generic-d20"`, and Classic 3d6 otherwise.
- Bad values fall back to the base pack's value without a warning. The pack is stored as you wrote it.

### Pack keys

| Key | Values (Classic 3d6 default) | Meaning |
|---|---|---|
| `id`, `name` | text | |
| `dice` | `{ "count": 3, "die": 6 }` | What a check rolls. Count is 1–20, die is 2–1000. Optional keys for custom faces, pools, kept dice and mixed kinds of dice: see **Extended dice** below. |
| `test` | `"under"` | `under`: the dice total must be ≤ the value (skill). `over`: dice + value (bonus) must be ≥ the target number. A pack with `dice.pool` or `dice.kinds` is always read as `over`. |
| `crit.mode` | `"none"` | `total` (the dice sum is checked against the lists) · `natural` (the first die's face; with more than one die it becomes `total`, unless `dice.keep` is set: then it is the first kept die) · `symbol` (a named symbol makes it critical, see **Extended dice**) · `none`. Pools (`dice.pool`, `dice.kinds`) only use `symbol` or `none`. |
| `crit.success` / `crit.failure` | `""` | Totals like `"3-4"` or `"17-18"`. A critical overrides success or failure. |
| `crit.successMax` / `crit.failureMin` | `""` | Critical ranges that move with skill: a formula on `{SKILL}` (the value rolled with). A roll at or below `successMax` is a critical success, at or above `failureMin` a critical failure, on top of the lists. Formulas: numbers, `{SKILL}`, `+ - * /`, brackets, `floor ceil round abs min max`. Example: `"successMax": "4 + min(2, max(0, {SKILL} - 14))"`, `"failureMin": "min(18, {SKILL} + 10)"`. A broken formula is ignored. They only count when `crit.mode` is `total` or `natural` (the Classic 3d6 base is `none`, so set `mode`). |
| `crit.effect` | `"none"` | What a critical **hit** does: `none` · `double` (damage dice doubled) · `max` (damage dice at maximum) · `nodefense` (the target can't defend) |
| `defense.model` | `"active"` | `active`: the defender rolls one of `names` against its own value. `passive`: the attack must reach a number (the sheet's `ac`, else `passiveBase` + the stat modifier of `passiveStat`). `opposed`: the defender rolls one of `names`, and that roll is compared with the attack's roll (see **Opposed defense**). |
| `defense.ties` | `"defender"` | `opposed` only: who wins when the two rolls are equal, `defender` or `attacker`. |
| `defense.names` | `["dodge","parry","block"]` | Defense words matched against the sheet's defense entries. |
| `defense.retreat` | `false` | `true` lets retreating add Combat's `retreatBonus`. |
| `defense.passiveName` / `passiveBase` / `passiveStat` | `"defense"` / `10` / `"agility"` | Used by passive defense. |
| `defense.against` | none | `{ "melee": [...], "ranged": [...] }`: which defenses work against each kind of attack. A kind that's missing allows every defense. An ability's own *Defended by* wins. |
| `defense.perTurn` | none | `{ "parry": 1 }`: how often each defense can be used between the defender's turns. A missing name means no limit. |
| `defense.again` | none | `{ "parry": -4 }`: a defense past its limit is still allowed at this modifier per extra use. If missing, it isn't allowed. |
| `armor` | `"reduce"` | `reduce`: armor subtracts from damage. `class`: armor adds to the passive defense in Combat Mode. Roll Dice's own attack rolls (the popup) don't add armor: the target is the sheet's `ac`, else `passiveBase` + the stat modifier. |
| `damage.multipliers` | `true` | Use the sheet's wound multipliers. |
| `damage.bonus.melee` / `ranged` | `""` | A stat role whose modifier is added to damage. |
| `damage.bonus.weapons` | `[]` | `[{ "match": "finesse", "stats": ["strength","agility"] }]`: a weapon whose name or stat text has the word `match` adds the best of `stats` instead. |
| `stats` | see below | role → the sheet names that fill it. |
| `statMod` | `"score"` | A formula on `score` that turns an attribute into the number rolled with. For example `floor((score - 10) / 2)`. |
| `checks` | `{ "easy": 3, "normal": 0, "hard": -3 }` | Free-form check difficulty: modifiers for `under` packs, target numbers for `over` packs. |
| `caps` | `{ "situation": 6, "judge": 4 }` | The largest free-form situation modifier and LLM judgement, in either direction. |
| `aim` | `null` | The bonus for aiming. `null` means Combat's `aimBonus` is used. |
| `labels` | `{ "value": "skill", "target": "target", "passive": "defense" }` | Words used in logs and prompts. |
| `symbols` | `{ "total": "", "cancel": [] }` | Named symbols on dice faces: see **Extended dice**. |
| `levels` | `[]` | Named results by margin: see **Result levels**. |

### Extended dice

All optional. A pack without them rolls exactly as described above. A pack uses extended dice when it sets `dice.faces`, `dice.pool`, `dice.keep`, `dice.kinds` or `crit.mode: "symbol"`, or when a roll asks for bonus or penalty dice.

| Key | Meaning |
|---|---|
| `dice.faces` | `[v1, v2, …]`: what each face is worth, face 1 first. A number (0 and negatives allowed) or an object of symbol counts, `{ "hit": 1, "spark": 1 }`. A face that is missing or doesn't read counts as its own number. The total is the sum of what the faces are worth. |
| `dice.pool` | A formula on `{VALUE}` (the value rolled with: the skill, attribute or bonus, modifiers included) and `{DC}` (the target number): how many dice are rolled, 0–100. The value then **sizes the pool and is not added** to the total. Example: `"{VALUE}"`. |
| `dice.keep` | How many dice count. The rest are rolled but dropped (shown in brackets in the log). |
| `dice.keepFrom` | `best` (the default: the highest for `over`, the lowest for `under`) · `highest` · `lowest`. |
| `dice.kinds` | `{ "name": { "die": 6, "faces": [...], "count": "formula" } }`: a pool of several kinds of dice, each with its own die size and faces. `count` is a formula on `{VALUE}`, `{DC}` and the pack's `dice.vars`. It replaces `dice.count` / `dice.die` / `dice.pool`. See *Mixed pools*. |
| `dice.vars` | `["CHAR", "SKILL", "UPGRADE"]`: more variable names the kinds' `count` formulas may use. A roll gives their values (`vars`); missing ones are 0. |
| `dice.need` | Pools only: a formula on `{VALUE}` and `{DC}`, the total the pool must reach. Default: the DC (the attack's target number, a save's DC), else `checks.normal`. Set it (e.g. `"1"`) when `{DC}` is used to size a kind of dice instead. |
| `symbols.total` | The symbol whose net count is the total. Numeric faces add to it. Without `total`, only numeric faces add to the total; symbol faces only show in `symbols` (and can make a symbol critical). |
| `symbols.cancel` | `[["hit", "miss"], ["boon", "bane"]]`: each pair cancels one for one, and what is left of each is its net count. Net counts are in the result's `symbols`. |
| `spend` | `[{ "name", "symbol", "cost", "text" }]`: what a roll's left-over symbols can buy (`cost`: how many of that symbol, default 1). The result lists what it can afford as `spendable: [{ name, symbol, cost, times, text }]`. Roll Dice buys nothing itself: the game decides (Combat Mode: a trigger at the `roll` stage reads `{S_<symbol>}`; by hand, the GM). |
| `crit.mode: "symbol"` | `crit.success` / `crit.failure` name a symbol. The roll is critical when its net count reaches `crit.successAt` / `crit.failureAt` (formulas on `{DICE}`, the number of dice rolled; default 1). A failure symbol that a cancel pair removed still counts by its raw number on the kept dice. |

**Bonus and penalty dice.** Anything that rolls through the pack can ask for `extra` dice (Combat Mode: the `dice` modifier). For a plain or kept roll, `+n` rolls n more dice and keeps the same number of the best ones; `−n` rolls n more and keeps the worst ones. In a pool, `extra` adds or takes away dice (never fewer than 0).

**Mixed pools: a count and a modifier for each kind.** Each kind of die has its own count and its own modifier, so nothing has to be packed into one number:
- `count` formulas can read named variables (`dice.vars`), e.g. a characteristic and a skill rank given separately.
- A roll can add or take away dice **of one kind**: `kinds: { "boost": 1, "setback": 2 }` (Combat Mode: the modifier keys `pool_<kind>`, from conditions, situations, macros).
- A roll can give a kind's count outright: `pool: { "ability": 2, "proficiency": 1 }` (a sheet row's own `pool`); `count` is not used for that kind then.
- `extra` as a number adds or takes away dice of the first kind; as `{ kind: n }` it is the same as `kinds`.

```json
{
  "id": "my-pool", "name": "Narrative pool", "test": "over",
  "dice": {
    "need": "1", "vars": ["CHAR", "SKILL", "UPGRADE"],
    "kinds": {
      "ability":     { "die": 8,  "faces": [{}, {"success":1}, {"success":1}, {"success":2}, {"advantage":1}, {"advantage":1}, {"success":1,"advantage":1}, {"advantage":2}], "count": "max({CHAR}, {SKILL}) - min({CHAR}, {SKILL}) - min({UPGRADE}, max({CHAR}, {SKILL}) - min({CHAR}, {SKILL}))" },
      "proficiency": { "die": 12, "faces": [{}, {"success":1}, {"success":1}, {"success":2}, {"success":2}, {"advantage":1}, {"success":1,"advantage":1}, {"success":1,"advantage":1}, {"success":1,"advantage":1}, {"advantage":2}, {"advantage":2}, {"triumph":1,"success":1}], "count": "min({CHAR}, {SKILL}) + {UPGRADE}" },
      "boost":       { "die": 6,  "faces": [{}, {}, {"success":1}, {"success":1,"advantage":1}, {"advantage":2}, {"advantage":1}], "count": "0" },
      "difficulty":  { "die": 8,  "faces": [{}, {"failure":1}, {"failure":2}, {"threat":1}, {"threat":1}, {"threat":1}, {"threat":2}, {"failure":1,"threat":1}], "count": "{DC}" },
      "setback":     { "die": 6,  "faces": [{}, {}, {"failure":1}, {"failure":1}, {"threat":1}, {"threat":1}], "count": "0" }
    }
  },
  "symbols": { "total": "success", "cancel": [["success", "failure"], ["advantage", "threat"]] },
  "crit": { "mode": "symbol", "success": "triumph", "failure": "despair" },
  "spend": [
    { "name": "Recover 1 strain", "symbol": "advantage", "cost": 1 },
    { "name": "A free maneuver", "symbol": "advantage", "cost": 2 },
    { "name": "Lose a maneuver", "symbol": "threat", "cost": 2 }
  ]
}
```
→ A check with `vars: { CHAR: 3, SKILL: 2 }`, `dc: 2` and `kinds: { setback: 1 }` rolls 1 ability, 2 proficiency, 2 difficulty and 1 setback die. With `UPGRADE: 1`, one ability die becomes proficiency. Three advantage left over: `spendable` lists *Recover 1 strain* ×3 and *A free maneuver* ×1. (The faces and names here are only an example: write your own.)

**How it reads.** A pool succeeds when its total is at or above `dice.need`, and the margin is total − need. A non-pool roll with faces or kept dice reads like a plain one: `over` adds the value and compares with the target number, `under` compares the total with the value.

**Log text.** Each die is shown as `face=worth` (`kind:face=worth` in a mixed pool). Dropped dice are in brackets. Net symbols are in square brackets: `good:2=hit good:6=hit+star bad:2=miss → 1 [1 hit, 1 star] vs DC 1 · critical success`.

**Chance.** The odds shown for extended dice come from 2000 simulated rolls, not an exact count.

### Opposed defense

With `defense.model: "opposed"`, Combat Mode rolls the attack and then the defense, and compares the two:
- **`over` packs and pools:** the defense total must reach the attack total. A tie goes to `defense.ties`. The attack isn't stopped by its own target number, only by the defense roll or a critical failure. If the target has no defense it can use, the attack's target number decides.
- **`under` packs:** the attack must succeed first. The defense then stops it if it succeeds by more than the attack did, or by as much on a tie that goes to the defender.
- **Margin:** what the attack won by (attack total − defense total, or the attack's margin − the defense's margin) is the attack's margin from then on, e.g. for Combat Mode's `damageMargin`.

A critical success on the defense always stops the attack, and a critical failure never does.

### Result levels

`levels: [{ "name": "strong", "atLeast": "3" }, { "name": "plain", "atLeast": "0" }]`. `atLeast` is a formula on `{VALUE}` and `{TARGET}`. Every roll gets the name of the highest threshold its margin reaches as `level` (none when it reaches none). The order you write them in doesn't matter. Negative thresholds name failures. Levels show in the log after the verdict, e.g. `success by 4 (strong)`, and Combat Mode formulas can read them as `{L_<name>}`.

### `stats`: connecting your sheet to the engine

Combat Mode and sheet rolls find attributes by **role**. The engine uses six roles:
- `strength`: shoving, grabbing, melee damage bonus, improvised weapons.
- `agility`: dodging, ranged damage bonus, grabs, unarmed contests.
- `mind`: tricks and talk.
- `health`: low-HP rolls named `health`.
- `will`: resisting threats, losing a spell.
- `perception`.

Each role lists the sheet **keys** that fill it, case-insensitive. A sheet key equal to the role name also fills it. Combat Mode uses the first name **in the list** that exists on the sheet. Roll Dice's own rolls (the passive defense stat) use the first **sheet key** that matches any name in the list. To get the same result in both, give each role names that match only one key on the sheet.

- If a pack **has** `stats`, it defines exactly its roles. Roles it leaves out are empty.
- If a pack has **no** `stats`, it gets the built-in names: Strength/Str, Agility/Agi/Dexterity/Dex, Mind/Intellect/Int, Health/Body/Constitution/Con, Will/Resolve, Perception/Awareness.
- **A role that finds no attribute rolls against 10, with no warning** (Combat Mode). In Roll Dice's popup, a `passiveStat` that finds no attribute adds 0 to `passiveBase`. If your sheet uses keys like `ST/DX/IQ/HT/Per`, you need a custom pack that lists them.

`statMod` formulas allow numbers, `score`, `+ - * /`, brackets, `floor ceil round abs min max`. An unknown word or character (including `SCORE` or `{score}`) makes the formula fall back to `score`. A missing `)` is read as if it were there, and text after a complete formula is ignored (`(score - 10) / 2 foo` reads as `(score - 10) / 2`).

---

## 3. The game system API

Other extensions reach the packs through `window.RollDice.system`:

| Call | Returns |
|---|---|
| `list()` | `[{ id, name, builtIn }]` |
| `get(id)` / `active()` / `activeId()` | A normalized pack (`get` falls back to the default pack) / the open chat's pack / its id |
| `normalize(pack)` | The pack with missing keys filled from its base pack |
| `test(pack, value, { dc, roll, extra, vars, kinds, pool })` | Rolls a check: `{ dice, sum, value, total, target, test, success, crit, margin, natural, level? }`. Extended dice add `{ extended: true, pool, kept, kinds, worth, symbols, spendable? }`. `dc` is the target number for `over` packs and pools. `roll(sides)` lets the caller supply the dice. `extra` asks for bonus (+) or penalty (−) dice. `vars`, `kinds`, `pool`: see *Mixed pools*. |
| `read(pack, dice, value, dc)` | Reads plain dice that are already rolled. |
| `describe(result, pack)` | The log text of a result. A result with `parts` (`[{ label, n }]`: what its value is made of) shows each one by name, and `dcParts` does the same for a fixed target number: `6 + 1 + 1 = 8 vs 10 (Punch) + 1 (Blessed) - 4 (lying down) = 7 · failure by 1`, `10 + 5 (Mace) + 2 (aim) = 17 vs AC 12 (ogre) - 3 (lying down) = 9`. Combat Mode fills them in. |
| `chance(pack, value, dc)` | The chance (0–1) that a check succeeds. |
| `critLists(pack, value)` / `critBounds(pack, value)` | The critical totals as list text / the skill-based bounds. They are empty for pools and symbol criticals. |
| `diceText(pack)` | How the pack rolls, in a few words: `"3d6"`, `"4d3 (faces -1 0 1)"`, `"a pool of d6 … sized by the skill"`, `"a mixed pool (good, bad)"` |
| `statMod`, `statScore`, `statRole`, `evalStatMod` | Attribute helpers (see `stats` above). |
| `setChatPack(id)`, `setDefaultPack(id)`, `chatPackId()`, `defaultPackId()` | Choose packs. |

Sheet rolls from Roll Dice's own popup use `test` and `describe` when the pack has extended dice, so they roll the same dice as Combat Mode.

## 4. What a sheet source must send

Extensions register with `window.RollDice.registerSource({ id, label, getCharacters })`. `getCharacters()` returns entries like this:

```
{ key, name, prefix?,
  rollables: [{ group, name, target }],                  // group "Attributes" entries are also read as attributes
  combat:   [{ group, kind: "roll", name, target, note?, pool?, poolVars? },      // attacks, defenses, abilities; pool / poolVars: mixed pools
             { group, kind: "damage", name, n, sides, add, type, mult, more? }],    // damage, linked to attacks by name
  hp?, fp?, move?, speed?, dr?, ac?, attrs?: { key: number }, resources?: [{ name, max }], macros?: [{ name, arg, args?, from, row? }], macroDefs?: [definition] }
```

`macros` are the home-brew macros found on the sheet (`{{haste}}` → `{ name: "haste", arg: "", args: [] }`, `{{immunity cold}}` → `{ name: "immunity", arg: "cold", args: ["cold"] }`). `macroDefs` are the definitions that say what they do. Roll Dice passes both through unchanged; Combat Mode applies them (see NPC-Book-Combat/RULES.md → `macros`).

`from` is the row a macro is written on and `row` what kind of row (`trait`, `item`, `ability`, `attack`): Combat Mode applies a macro on an ability or attack to that row only. For a mixed pool pack, a `combat` entry may give its own dice counts (`pool: { "ability": 2, "proficiency": 1 }`) and values for the pack's `dice.vars` (`poolVars: { "CHAR": 3, "SKILL": 2 }`).

A character with neither rollables nor combat entries isn't offered.

---

## Examples

A 3d6 roll-under pack with skill-based criticals, no defense against a critical hit, retreat on, one block and one parry per turn (more parries at −4 each) and no parry against ranged attacks:

```json
{
  "base": "classic-3d6",
  "crit": { "mode": "total", "success": "3-4", "failure": "18", "successMax": "4 + min(2, max(0, {SKILL} - 14))", "failureMin": "min(18, {SKILL} + 10)", "effect": "nodefense" },
  "defense": { "model": "active", "names": ["dodge", "parry", "block"], "retreat": true,
    "against": { "melee": ["dodge", "parry", "block"], "ranged": ["dodge", "block"] },
    "perTurn": { "parry": 1, "block": 1 }, "again": { "parry": -4 } },
  "stats": { "strength": ["Str"], "agility": ["Dex"], "mind": ["Int"], "health": ["Con"], "will": ["Will"], "perception": ["Per"] }
}
```

Four three-sided dice worth −1, 0 and +1, added to the bonus, with opposed defense rolls:

```json
{
  "base": "generic-d20", "test": "over",
  "dice": { "count": 4, "die": 3, "faces": [-1, 0, 1] },
  "crit": { "mode": "none" }, "checks": { "easy": -1, "normal": 0, "hard": 2 },
  "defense": { "model": "opposed", "names": ["dodge"], "ties": "defender" },
  "levels": [{ "name": "strong", "atLeast": "3" }]
}
```

A pool of six-sided dice, one die per point of the value, where 5 and 6 are hits, a pool must reach the DC, and every die showing 1 counts as a slip (a critical failure when half the dice or more show it):

```json
{
  "base": "generic-d20",
  "dice": { "die": 6, "pool": "{VALUE}", "faces": [{ "slip": 1 }, 0, 0, 0, 1, 1] },
  "crit": { "mode": "symbol", "failure": "slip", "failureAt": "ceil({DICE} / 2)" },
  "defense": { "model": "opposed", "names": ["dodge"] },
  "checks": { "easy": 1, "normal": 2, "hard": 4 }
}
```

A mixed pool: good dice from the value, bad dice from the DC, and symbols that cancel. One net hit is a success, and a star is a critical success:

```json
{
  "base": "generic-d20",
  "dice": { "need": "1", "kinds": {
    "good": { "die": 6, "count": "{VALUE}", "faces": [{}, { "hit": 1 }, { "hit": 1 }, { "boon": 1 }, { "hit": 1, "boon": 1 }, { "hit": 1, "star": 1 }] },
    "bad":  { "die": 6, "count": "{DC}",    "faces": [{}, { "miss": 1 }, { "miss": 1 }, { "bane": 1 }, { "miss": 1, "bane": 1 }, { "miss": 1, "doom": 1 }] } } },
  "symbols": { "total": "hit", "cancel": [["hit", "miss"], ["boon", "bane"]] },
  "crit": { "mode": "symbol", "success": "star", "failure": "doom" },
  "defense": { "model": "passive", "passiveBase": 1, "passiveStat": "" }
}
```

In the mixed pool, the target's passive defense number (here 1 + nothing) is the `{DC}`, so it sets how many bad dice are rolled. Combat Mode formulas can read `{S_boon}`, `{S_bane}`, `{S_star}` and `{S_doom}` from the attack roll.
