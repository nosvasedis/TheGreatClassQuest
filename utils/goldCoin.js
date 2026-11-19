/**
 * Gold's own icon, the same minted coin everywhere (drawn in styles/gold_coin.css).
 * Use it wherever a Gold amount is shown, never a star or the 🪙 emoji.
 */
export const GOLD_COIN_HTML = '<i class="gq-gold" aria-hidden="true"></i>';

/** The coin with extra classes (e.g. a component's own icon class for spacing). */
export function goldCoinHtml(extraClass = '') {
    return extraClass ? `<i class="gq-gold ${extraClass}" aria-hidden="true"></i>` : GOLD_COIN_HTML;
}

/** "125" + coin, as HTML, for places that used to write `${gold} 🪙` as text. */
export function goldAmountHtml(amount) {
    const n = Number(amount);
    return `${Number.isFinite(n) ? n : 0} ${GOLD_COIN_HTML}`;
}
