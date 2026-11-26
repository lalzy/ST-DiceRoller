import { getPack, defaultPackId, setDefaultPack, chatPackId, setChatPack, templateStore, packRules } from '../system/index.js';
import { BUILT_IN, CLASSIC_3D6 } from '../system/packs.js';
import { mountRulesTemplates } from './rulesTemplates.js';

function summary(p) {
    const roll = p.test === 'under' ? `${p.dice.count}d${p.dice.die}, roll at or under the ${p.labels.value}` : `${p.dice.count}d${p.dice.die} + ${p.labels.value}, meet or beat the ${p.labels.target}`;
    const def = p.defense.model === 'active' ? `defender rolls ${p.defense.names.join(' / ') || 'a defense'}` : `attacks must reach the target's ${p.defense.passiveName}`;
    const armor = p.armor === 'reduce' ? 'armor reduces damage' : `armor adds to ${p.defense.passiveName}`;
    return `${roll} · ${def} · ${armor}`;
}

const BUILT_INS = BUILT_IN.map(p => ({ id: p.id, name: p.name, rules: packRules(p) }));

/** "Game system" block in Extensions → Roll Dice. */
export function systemBlock() {
    return `
      <div class="roll-dice-settings-system">
        <b>Game system</b>
        <small>Used when you roll from a character sheet, and by Combat Mode. Rolling by hand works as before.</small>
        <div class="rd-sys-summary"><small></small></div>
        <div class="rd-sys-templates"></div>
      </div>`;
}

export function bindSystem(box) {
    const summaryEl = box.querySelector('.rd-sys-summary small');
    const showSummary = () => {
        const p = getPack(chatPackId() || defaultPackId());
        summaryEl.textContent = `In this chat: ${p.name}. ${summary(p)}`;
    };
    const block = mountRulesTemplates(box.querySelector('.rd-sys-templates'), {
        prefix: 'rd',
        intro: 'The active template is the game system for new chats; "This chat uses" can pick another one for the open chat. Missing keys are filled in from the built-in pack a template is closest to.',
        builtIns: BUILT_INS,
        newRules: () => packRules(CLASSIC_3D6),
        store: templateStore,
        save: () => SillyTavern.getContext().saveSettingsDebounced(),
        validate: (rules) => {
            const out = [];
            if (rules.test !== undefined && !['under', 'over'].includes(rules.test)) out.push(`test "${rules.test}": use "under" or "over"`);
            if (rules.armor !== undefined && !['reduce', 'class'].includes(rules.armor)) out.push(`armor "${rules.armor}": use "reduce" or "class"`);
            if (rules.id !== undefined || rules.name !== undefined) out.push('id and name are ignored here: the template\'s name is used');
            return out;
        },
        apply: (_rules, id) => { setDefaultPack(id); showSummary(); return ''; },
        exportName: 'roll-dice-system',
        chatRow: { label: 'This chat uses', get: chatPackId, set: (id) => { setChatPack(id); showSummary(); } },
    });
    // the chat's choice changes when another chat opens
    const refresh = () => { block.refresh(); showSummary(); };
    try {
        const c = SillyTavern.getContext();
        c.eventSource?.on?.(c.event_types?.CHAT_CHANGED, refresh);
    } catch { /* ignore */ }
    document.addEventListener('rolldice:pack', showSummary);
    showSummary();
}
