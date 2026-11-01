// features/legendaryCatalog.mjs — the Legendary Artifacts catalog (pure data, no Firebase).
// Powers live in features/powerUps.js; art in features/legendaryArt.mjs.
import { PATHFINDER_CLASS_QUEST_BONUS_STARS } from './awardLogReasonMeta.js';

/**
 * Legendary Artifacts come as five relics, each with a few forms (variants). The shelf shows one
 * card per relic; the child picks the form. Every form is its own inventory item with its own id,
 * so older owned items keep working. `blurb` is the short line on the shelf card (fits without
 * cutting); `description` is the full rule, shown on hover, in the parcel and in the Trophy Room. Art: features/legendaryArt.mjs.
 */
export const LEGENDARY_FAMILIES = [
    { id: 'purse', name: "Fortune's Purse", tagline: 'Gold, bargains and a kinder wheel.' },
    { id: 'guild', name: 'The Guild Standard', tagline: 'Glory for your guild.' },
    { id: 'wayfinder', name: "The Wayfinder's Kit", tagline: 'Help the whole class on its quest.' },
    { id: 'story', name: "The Storyteller's Relics", tagline: 'Step into the class story.' },
    { id: 'heart', name: "The Hero's Heart", tagline: "Kindness for Hero's Boons." },
];

export const LEGENDARY_ARTIFACTS = [
    { id: 'leg_aurum_silver', family: 'purse', form: 'Silver', name: 'Silver Satchel', price: 16, blurb: "25% off your next Market buy this month.", description: '25% off your next Mystic Market buy this month.', icon: '👝' },
    { id: 'leg_gilded', family: 'purse', form: 'Star', name: 'Scroll of the Gilded Star', price: 20, blurb: "Your next star pays triple Gold.", description: 'The next star you earn pays triple Gold.', icon: '✨' },
    { id: 'leg_aurum', family: 'purse', form: 'Gold', name: 'Aurum Satchel', price: 32, blurb: "50% off your next Market buy this month.", description: '50% off your next Mystic Market buy this month.', icon: '💰' },
    { id: 'leg_bulwark', family: 'purse', form: 'Favor', name: "Fortune's Favor", price: 48, blurb: "Your guild's next Fortune's Wheel is gilded: no bad wedges.", description: "Your guild's next Fortune's Wheel in your class is gilded: no storms, no Trickster and no common wedges.", icon: '🎡' },
    { id: 'leg_glory_banner', family: 'guild', form: 'Pennant', name: 'Pennant of Glory', price: 35, blurb: "Your next 3 stars each add +1 Guild Glory.", description: 'Your next 3 stars each write +1 bonus Guild Glory into the ledger.', icon: '⚜️' },
    { id: 'leg_glory_chalice', family: 'guild', form: 'Chalice', name: 'Chalice of Unity', price: 55, blurb: "+1 Glory now for you and every guildmate in class.", description: '+1 Glory right now for you and every guildmate in your class.', icon: '🏆' },
    { id: 'leg_glory_crown', family: 'guild', form: 'Standard', name: 'Guild Standard', price: 75, blurb: "Your name flies on the guild banner all Chapter, +2 Glory.", description: "Your name flies on your guild's banner in the Guild Hall for the rest of this month's Chapter, plus +2 Glory.", icon: '🚩' },
    { id: 'leg_hourglass', family: 'wayfinder', form: 'Timer', name: 'Time Warp Hourglass', price: 25, blurb: "+5 minutes on your class's running Bounty timers.", description: "Adds 5 minutes to your class's running Bounty timers.", icon: '⏳' },
    { id: 'leg_pathfinder', family: 'wayfinder', form: 'Map', name: 'The Pathfinder’s Map', price: 60, blurb: `+${PATHFINDER_CLASS_QUEST_BONUS_STARS} Team Quest stars for your class. One a month.`, description: `+${PATHFINDER_CLASS_QUEST_BONUS_STARS} Stars for your class's Team Quest. One map per class each month.`, icon: '🗺️' },
    { id: 'leg_quill', family: 'story', form: 'Quill', name: "Archivist's Quill", price: 40, blurb: "Your next Training Grounds bonus is a full star, in any game.", description: 'Your next Training Grounds class bonus gives you 1 star instead of half a star, in any of the four games.', icon: '✒️' },
    { id: 'leg_protagonist', family: 'story', form: 'Mask', name: 'The Mask of the Protagonist', price: 75, blurb: "You become the next Hero of the Day. One a month.", description: 'You are chosen as the next Hero of the Day in your class. One mask a month.', icon: '🎭' },
    { id: 'leg_kindness', family: 'heart', form: 'Locket', name: 'Kindness Locket', price: 28, blurb: "Your next 3 Hero's Boons cost 0 Gold.", description: "Your next 3 Hero's Boons cost 0 Gold.", icon: '💗' },
    { id: 'leg_compassion', family: 'heart', form: 'Token', name: 'Compassion Token', price: 55, blurb: "Hero's Boons cost 0 Gold for the rest of the month.", description: "Every Hero's Boon you give costs 0 Gold for the rest of this month.", icon: '💝' },
];

/**
 * Retired in the November 2026 audit: no longer sold or won, but a child who owns one can still use it.
 * Crystal of Clarity only sparkled for a second, the Herald's Banner only showed a toast on the
 * teacher's screen, and the Elixir of Luck and Starfall Catalyst sold extra stars for Gold.
 */
export const RETIRED_ARTIFACTS = [
    { id: 'leg_clarity', name: 'Crystal of Clarity', price: 15, description: 'A gem that glimmers on your card.', icon: '💎', retired: true },
    { id: 'leg_luck', name: 'Elixir of Luck', price: 30, description: '50% chance for +1 star during your next lesson.', icon: '🍀', retired: true },
    { id: 'leg_banner', name: "The Herald's Banner", price: 40, description: 'A celebration banner for the class.', icon: '📢', retired: true },
    { id: 'leg_catalyst', name: 'The Starfall Catalyst', price: 50, description: 'Double the stars for your next high test score.', icon: '📜', retired: true },
];

/** The forms of one relic, cheapest first. */
export function legendaryFamilyVariants(familyId) {
    return LEGENDARY_ARTIFACTS.filter((a) => a.family === familyId).sort((a, b) => a.price - b.price);
}

