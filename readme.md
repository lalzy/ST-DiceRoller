# ST-DiceRoller

A small, no-nonsense dice roller for [SillyTavern](https://github.com/SillyTavern/SillyTavern).

Pick your dice from the wand menu, roll, and the result is put into your message, so you **and** the LLM see the same roll with the dice, the total and whether it succeeded.

![Roll Dice popup](image1.png)

## Example

```
Persuasion Roll (3d6 vs <= 12): 4 + 2 + 6 = 12 (Success)
Attack Roll (1d20 vs >= 15): 11 (Failure)
Roll (2d8): 4 + 1 = 5
```

The roll happens in the extension before you send, and the text goes into your input box. The message is sent exactly as you see it, so nothing gets re-rolled later and the LLM doesn't have to guess what a bare number means.

## Features

- **Wand menu action**: ✨ → **Roll Dice**
- **Two presets: Skill and Combat**, each with its own default number of dice, die type and comparison
- **Versus target** (optional) with `>`, `>=`, `<` or `<=`, giving an automatic **Success** / **Failure**
  - GURPS-style: `3d6 vs <= skill`
  - D&D-style: `1d20 vs >= DC/AC`
- **Optional name**, e.g. *Persuasion*, *Stealth*, *Attack*. If you leave it empty the result reads `Roll (…)`
- Dice: d1, d2, d3, d4, d6, d8, d10, d12, d20, d100, from 1 to 100 dice
- Fair rolls (uses `crypto.getRandomValues`, so there's no modulo bias)
- Inserts at your cursor, so you can write around the roll
- **Enter** rolls, **Esc** cancels

## Installation

In SillyTavern: **Extensions** → **Install extension** → paste:

```
https://github.com/lalzy/ST-DiceRoller
```

Or install manually: copy this folder into `SillyTavern/data/default-user/extensions/` and reload SillyTavern.

## Usage

1. Click the **✨ wand** next to the chat input → **Roll Dice**
2. Choose **Skill** or **Combat** (this loads that preset's defaults)
3. Optionally type a name, then adjust the number of dice and the die type
4. Optionally set a **Versus** comparison and target number
5. Click **Roll** (or press Enter). The result is inserted into your message
6. Send as usual

## Settings

**Extensions → Roll Dice** has a row for each preset:

| Preset | # of dice | Die | Versus |
|--------|-----------|-----|--------|
| Skill  | 3 (default) | d6 (default) | `<=` (default) |
| Combat | 1 (default) | d20 (default) | `>=` (default) |

The popup always opens with these defaults. Changing values in the popup only affects that one roll.

## Notes

- Works in single-character and group chats
- No prompt injection, no slash commands and no macros. It's just text in your message
