import { openRollPopup } from './popup/index.js';

const ID = 'roll_dice_wand';

function addWandButton() {
    if (document.getElementById(ID)) return;
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return;
    const item = document.createElement('div');
    item.id = ID;
    item.className = 'list-group-item flex-container flexGap5';
    item.title = 'Roll dice and insert the result into your message';
    item.innerHTML = '<div class="fa-solid fa-dice extensionsMenuExtensionButton"></div><span>Roll Dice</span>';
    item.addEventListener('click', () => {
        const btn = document.getElementById('extensionsMenuButton');
        if (document.getElementById('extensionsMenu')?.style.display !== 'none') btn?.click();
        openRollPopup().catch(e => console.error('[RollDice]', e));
    });
    menu.appendChild(item);
}

/** Add the wand-menu entry; retry for up to 30 s if the menu isn't in the DOM yet. */
export function mountWandButton() {
    addWandButton();
    if (document.getElementById(ID)) return;
    const t = setInterval(() => { addWandButton(); if (document.getElementById(ID)) clearInterval(t); }, 500);
    setTimeout(() => clearInterval(t), 30000);
}
