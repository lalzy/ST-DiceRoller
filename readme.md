# ST-DiceRoller

A simple dice-roller for [SillyTavern](https://github.com/SillyTavern/SillyTavern). Extention that comes with it doesn't send results to LLM, using macro's is pretty shit so had claude generate a proper one that injects results to chat so the result get sent.

While relatively light-weight it's also somewhat powerful, you select a target and can select what success threshold is (gurps it's less than, D&D it's greater than for example),  you can choose the default die for Combat and Non-Combat rolls (might extend to allow more default die at some point). 


![Roll Dice popup](image1.png)

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


## Notes
- Completely vibe-coded. 0 Human reading of the code, and not battle tested yet.