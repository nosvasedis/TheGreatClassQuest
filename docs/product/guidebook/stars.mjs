/** Amber star marks that match Award Stars buttons — used in guidebook HTML. */

export function starIco() {
  return '<span class="star-amt" aria-hidden="true"><i class="fas fa-star"></i></span>';
}

export function starsOf(n) {
  const count = Math.max(1, Math.min(3, Number(n) || 1));
  return starIco().repeat(count);
}

/** Paint star amounts in already-escaped (or plain) text. Do not run on full HTML with attributes. */
export function decorateStarCounts(s) {
  let t = String(s || '');
  t = t.replace(
    /\b1,\s*2,\s*or\s*3\s*stars\b/gi,
    `1 ${starIco()}, 2 ${starsOf(2)}, or 3 ${starsOf(3)}`
  );
  t = t.replace(
    /\b1,\s*2\s*ή\s*3\s*αστέρια\b/gi,
    `1 ${starIco()}, 2 ${starsOf(2)} ή 3 ${starsOf(3)}`
  );
  t = t.replace(
    /([+]?\d+(?:\.\d+)?)\s+(?:Team Quest\s+)?stars?\b/gi,
    (_, n) => `${n} ${starIco()}`
  );
  t = t.replace(
    /([+]?\d+(?:[.,]\d+)?)\s*αστ[εέ]ρι(?:α|ών)?/gi,
    (_, n) => `${n} ${starIco()}`
  );
  t = t.replace(/\b(\d+)-star\b/gi, (_, n) => `${n}${starIco()}`);
  t = t.replace(/\b(monthly|bonus|total)\s+stars\b/gi, (_, w) => `${w} ${starIco()}`);
  t = t.replace(/\bμηνιαί[αο]\s+αστέρια\b/gi, (m) => m.replace(/αστέρια/i, starIco()));
  return t;
}
