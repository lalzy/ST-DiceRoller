# Rules in Roll Dice

Roll Dice holds two kinds of rule data:

1. **Settings** for rolling by hand (Extensions → Roll Dice): dice per preset, critical totals, damage floors.
2. **Game system packs** (Extensions → Roll Dice → Game system). They set how every roll made from a character sheet, and by Combat Mode, is rolled and read.

This file describes exactly what the code reads (`src/system/packs.js`, `src/system/resolve.js`, `src/core/constants.js`).

---

## 1. Settings for rolling by hand

These are set per preset (**Skill** and **Combat**). They're used only by the roll popup when you roll by hand. **Custom dice** starts from the Skill preset (dice, comparison, critical totals) until you have rolled once; after that it opens on the dice you used last. Each line of dice has its own modifier, and the critical totals are checked against the dice alone.

| Setting | Default | Meaning |
|---|---|---|
| Number of dice, die type | Skill: 3d6 · Combat: 1d20 | Die types: 1, 2, 3, 4, 6, 8, 10, 12, 20, 100. Count: 1–100. |
| Comparison | Skill `<=` · Combat `>=` | `>`, `>=`, `<`, `<=` against the Versus number. |
| Critical success / failure totals | empty | Lists like `3-4` or `17-18`, separated by commas. They are checked before the comparison. |
| Minimum damage | empty (0) | The lowest a damage roll totals, before armor. |
| Minimum injury | empty (0) | The lowest injury once damage gets through armor. |

Rolls made **from a sheet** use the chat's game system pack instead of these settings. Damage dice keep their own die size.

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
| `dice` | `{ "count": 3, "die": 6 }` | What a check rolls. Count is 1–20, die is 2–1000. |
| `test` | `"under"` | `under`: the dice total must be ≤ the value (skill). `over`: dice + value (bonus) must be ≥ the target number. |
| `crit.mode` | `"none"` | `total` (the dice sum is checked against the lists) · `natural` (the first die's face; with more than one die it becomes `total`) · `none` |
| `crit.success` / `crit.failure` | `""` | Totals like `"3-4"` or `"17-18"`. A critical overrides success or failure. |
| `crit.successMax` / `crit.failureMin` | `""` | Critical ranges that move with skill: a formula on `{SKILL}` (the value rolled with). A roll at or below `successMax` is a critical success, at or above `failureMin` a critical failure, on top of the lists. Formulas: numbers, `{SKILL}`, `+ - * /`, brackets, `floor ceil round abs min max`. Example: `"successMax": "4 + min(2, max(0, {SKILL} - 14))"`, `"failureMin": "min(18, {SKILL} + 10)"`. A broken formula is ignored. |
| `crit.effect` | `"none"` | What a critical **hit** does: `none` · `double` (damage dice doubled) · `max` (damage dice at maximum) · `nodefense` (the target can't defend) |
| `defense.model` | `"active"` | `active`: the defender rolls one of `names`. `passive`: the attack must reach a number (the sheet's `ac`, else `passiveBase` + the stat modifier of `passiveStat`). |
| `defense.names` | `["dodge","parry","block"]` | Defense words matched against the sheet's defense entries. |
| `defense.retreat` | `false` | `true` lets retreating add Combat's `retreatBonus`. |
| `defense.passiveName` / `passiveBase` / `passiveStat` | `"defense"` / `10` / `"agility"` | Used by passive defense. |
| `defense.against` | none | `{ "melee": [...], "ranged": [...] }`: which defenses work against each kind of attack. A kind that's missing allows every defense. An ability's own *Defended by* wins. |
| `defense.perTurn` | none | `{ "parry": 1 }`: how often each defense can be used between the defender's turns. A missing name means no limit. |
| `defense.again` | none | `{ "parry": -4 }`: a defense past its limit is still allowed at this modifier per extra use. If missing, it isn't allowed. |
| `armor` | `"reduce"` | `reduce`: armor subtracts from damage. `class`: armor adds to the passive defense. |
| `damage.multipliers` | `true` | Use the sheet's wound multipliers. |
| `damage.bonus.melee` / `ranged` | `""` | A stat role whose modifier is added to damage. |
| `damage.bonus.weapons` | `[]` | `[{ "match": "finesse", "stats": ["strength","agility"] }]`: a weapon whose name or stat text has the word `match` adds the best of `stats` instead. |
| `stats` | see below | role → the sheet names that fill it. |
| `statMod` | `"score"` | A formula on `score` that turns an attribute into the number rolled with. For example `floor((score - 10) / 2)`. |
| `checks` | `{ "easy": 3, "normal": 0, "hard": -3 }` | Free-form check difficulty: modifiers for `under` packs, target numbers for `over` packs. |
| `caps` | `{ "situation": 6, "judge": 4 }` | The largest free-form situation modifier and LLM judgement, in either direction. |
| `aim` | `null` | The bonus for aiming. `null` means Combat's `aimBonus` is used. |
| `labels` | `{ "value": "skill", "target": "target", "passive": "defense" }` | Words used in logs and prompts. |

### `stats`: connecting your sheet to the engine

Combat Mode and sheet rolls find attributes by **role**. The engine uses six roles:
- `strength`: shoving, grabbing, melee damage bonus, improvised weapons.
- `agility`: dodging, ranged damage bonus, grabs, unarmed contests.
- `mind`: tricks and talk.
- `health`: low-HP rolls named `health`.
- `will`: resisting threats, losing a spell.
- `perception`.

Each role lists the sheet **keys** that fill it, case-insensitive. The first one that exists on the sheet is used.

- If a pack **has** `stats`, it defines exactly its roles. Roles it leaves out are empty.
- If a pack has **no** `stats`, it gets the built-in names: Strength/Str, Agility/Agi/Dexterity/Dex, Mind/Intellect/Int, Health/Body/Constitution/Con, Will/Resolve, Perception/Awareness.
- **A role that finds no attribute rolls against 10, with no warning.** If your sheet uses keys like `ST/DX/IQ/HT/Per`, you need a custom pack that lists them.

`statMod` formulas allow numbers, `score`, `+ - * /`, brackets, `floor ceil round abs min max`. A formula that doesn't parse falls back to `score`.

---

## 3. What a sheet source must send

Extensions register with `window.RollDice.registerSource({ id, label, getCharacters })`. `getCharacters()` returns entries like this:

```
{ key, name, prefix?,
  rollables: [{ group, name, target }],                  // group "Attributes" entries are also read as attributes
  combat:   [{ group, kind: "roll", name, target, note? },                         // attacks, defenses, abilities
             { group, kind: "damage", name, n, sides, add, type, mult, more? }],    // damage, linked to attacks by name
  hp?, fp?, move?, speed?, dr?, ac?, attrs?: { key: number }, resources?: [{ name, max }], macros?: [{ name, arg, args?, from }], macroDefs?: [definition] }
```

`macros` are the home-brew macros found on the sheet (`{{haste}}` → `{ name: "haste", arg: "", args: [] }`, `{{immunity cold}}` → `{ name: "immunity", arg: "cold", args: ["cold"] }`). `macroDefs` are the definitions that say what they do. Roll Dice passes both through unchanged; Combat Mode applies them (see NPC-Book-Combat/RULES.md → `macros`).

A character with neither rollables nor combat entries isn't offered.

---

## Example

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
