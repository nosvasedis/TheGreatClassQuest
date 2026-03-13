function simpleHash(value) {
    let hash = 0;
    const str = String(value || '');
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

const VARIANT_TRAITS = {
    emberfang: [
        { key: 'cindercrest', label: 'Cindercrest', promptFlavor: 'distinctive cinder-black head crest and ember-flecked scales' },
        { key: 'sunscale', label: 'Sunscale', promptFlavor: 'bright gold-edged scales and warm sunlit horns' },
        { key: 'lavatail', label: 'Lavatail', promptFlavor: 'glowing lava-striped tail and fiery orange wing edges' },
        { key: 'ashwing', label: 'Ashwing', promptFlavor: 'dark ash-gray wings with glowing red vein patterns' },
        { key: 'sparkfang', label: 'Sparkfang', promptFlavor: 'tiny sparkling fangs and scattered star-like embers across the body' }
    ],
    frostpaw: [
        { key: 'auroratail', label: 'Auroratail', promptFlavor: 'aurora-tinted tail and faint pastel glimmers in the fur' },
        { key: 'crystalear', label: 'Crystalear', promptFlavor: 'translucent crystal-like ear tips and icy whiskers' },
        { key: 'snowmask', label: 'Snowmask', promptFlavor: 'soft silver face markings and moonlit blue paws' },
        { key: 'glacierstep', label: 'Glacierstep', promptFlavor: 'tiny glacier-blue paw glow and frosted shoulder markings' },
        { key: 'winterbloom', label: 'Winterbloom', promptFlavor: 'small snowflake bloom markings and shimmering white-gold fur accents' }
    ],
    thornback: [
        { key: 'mosscrown', label: 'Mosscrown', promptFlavor: 'a distinct mossy crown and leafy shoulder tufts' },
        { key: 'amberroot', label: 'Amberroot', promptFlavor: 'amber-glowing root patterns and bark streaks' },
        { key: 'fernback', label: 'Fernback', promptFlavor: 'fern fronds sprouting along the back and earthy green markings' },
        { key: 'stonehide', label: 'Stonehide', promptFlavor: 'stone-speckled bark texture and rugged gray-green patches' },
        { key: 'wildbloom', label: 'Wildbloom', promptFlavor: 'tiny wildflower accents and bright spring-green highlights' }
    ],
    veilshade: [
        { key: 'starveil', label: 'Starveil', promptFlavor: 'tiny star-like lights inside the shadow body and a glowing dusk aura' },
        { key: 'moonclaw', label: 'Moonclaw', promptFlavor: 'crescent-shaped claw glows and pale lunar eye markings' },
        { key: 'misttail', label: 'Misttail', promptFlavor: 'extra long misty tail and smoky silver outline' },
        { key: 'riftmark', label: 'Riftmark', promptFlavor: 'small violet rift markings across the body and luminous paw tips' },
        { key: 'nightspark', label: 'Nightspark', promptFlavor: 'deep midnight shadows with scattered spark-like purple embers' }
    ],
    sparkling: [
        { key: 'sunribbon', label: 'Sunribbon', promptFlavor: 'flowing sunlit ribbon trails and peach-gold glow accents' },
        { key: 'roseflare', label: 'Roseflare', promptFlavor: 'soft rose-gold highlights and warm coral sparkles' },
        { key: 'haloheart', label: 'Haloheart', promptFlavor: 'heart-shaped halo details and bright honey-colored wings' },
        { key: 'daybreak', label: 'Daybreak', promptFlavor: 'distinct sunrise gradient feathers and pale pink dawn light' },
        { key: 'goldsong', label: 'Goldsong', promptFlavor: 'radiant golden shimmer with musical spark motifs around the body' }
    ]
};

export function getFamiliarVariant(typeId, studentId) {
    const traits = VARIANT_TRAITS[typeId] || [];
    if (!traits.length) {
        return {
            key: 'standard',
            label: 'Standard',
            promptFlavor: 'a distinctive but consistent magical companion design'
        };
    }

    const index = simpleHash(`${typeId}:${studentId}`) % traits.length;
    return traits[index];
}

export function normalizeFamiliarName(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 24);
}
