function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateWheelSegmentsFromPool(leagueLevel, allSegments, rarityWeights, juniorLeagues = [], options = {}) {
  const {
    segmentCount = 20,
    maxAttempts = 500,
    maxCursed = 1,
    maxMythic = 1,
    maxEpic = 2,
    maxLegendary = 1,
    maxNegative = 4,
    juniorBlockedNegativeIds = ['glory_eclipse', 'glory_heist', 'tangled_web', 'lightning_strike', 'star_snatch', 'mythic_calamity'],
  } = options;

  const isJunior = (juniorLeagues || []).includes(leagueLevel);

  let pool = (allSegments || []).filter((seg) => {
    if (isJunior && seg.rarity === 'mythic') return false;
    if (isJunior && seg.rarity === 'cursed') return false;
    if (isJunior && seg.category === 'negative' && juniorBlockedNegativeIds.includes(seg.id)) return false;
    return true;
  });

  const weighted = [];
  for (const seg of pool) {
    const weight = (rarityWeights || {})[seg.rarity] || 10;
    for (let i = 0; i < weight; i += 1) weighted.push(seg);
  }

  const selected = new Map();
  let attempts = 0;

  let cursedCount = 0;
  let mythicCount = 0;
  let epicCount = 0;
  let legendaryCount = 0;
  let negativeCount = 0;
  let hasRarePlus = false;

  while (selected.size < segmentCount && attempts < maxAttempts) {
    attempts += 1;
    const candidate = weighted[Math.floor(Math.random() * weighted.length)];
    if (!candidate || selected.has(candidate.id)) continue;

    if (candidate.rarity === 'cursed' && cursedCount >= maxCursed) continue;
    if (candidate.rarity === 'mythic' && mythicCount >= maxMythic) continue;
    if (candidate.rarity === 'epic' && epicCount >= maxEpic) continue;
    if (candidate.rarity === 'legendary' && legendaryCount >= maxLegendary) continue;
    if (candidate.category === 'negative' && negativeCount >= maxNegative) continue;

    selected.set(candidate.id, candidate);
    if (candidate.rarity === 'cursed') cursedCount += 1;
    if (candidate.rarity === 'mythic') mythicCount += 1;
    if (candidate.rarity === 'epic') epicCount += 1;
    if (candidate.rarity === 'legendary') legendaryCount += 1;
    if (candidate.category === 'negative') negativeCount += 1;
    if (['rare', 'epic', 'legendary', 'mythic'].includes(candidate.rarity)) hasRarePlus = true;
  }

  if (!hasRarePlus && pool.some(s => ['rare', 'epic', 'legendary', 'mythic'].includes(s.rarity))) {
    const rares = pool.filter(s => ['rare', 'epic', 'legendary', 'mythic'].includes(s.rarity));
    const rare = rares[Math.floor(Math.random() * rares.length)];
    const replaceable = [...selected.values()].filter(s => s.rarity === 'common' || s.rarity === 'uncommon');
    if (replaceable.length > 0 && rare) {
      selected.delete(replaceable[0].id);
      selected.set(rare.id, rare);
    }
  }

  return shuffleArray([...selected.values()]);
}

