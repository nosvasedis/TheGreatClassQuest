function withMeta(card, definition) {
    if (!card) return null;
    return {
        ...card,
        family: definition.family,
        sizeTier: definition.sizeTier,
        preferredZones: definition.preferredZones
    };
}

const exactDefinitions = [
    {
        type: 'school_pulse',
        family: 'progress',
        sizeTier: 'standard',
        preferredZones: ['sky-left', 'horizon-left'],
        resolve: ({ handlers }) => handlers.getSchoolPulseCard()
    },
    {
        type: 'treasury_school',
        family: 'treasury',
        sizeTier: 'standard',
        preferredZones: ['harbor-right', 'sky-right'],
        resolve: ({ handlers }) => handlers.getTreasuryCard(null)
    },
    {
        type: 'class_quest',
        family: 'progress',
        sizeTier: 'feature',
        preferredZones: ['horizon-left', 'sky-left'],
        resolve: ({ handlers, classId }) => handlers.getClassQuestCard(classId)
    },
    {
        type: 'treasury_class',
        family: 'treasury',
        sizeTier: 'standard',
        preferredZones: ['harbor-right', 'horizon-right'],
        resolve: ({ handlers, classId }) => handlers.getTreasuryCard(classId)
    },
    {
        type: 'streak',
        family: 'attendance',
        sizeTier: 'compact',
        preferredZones: ['harbor-left', 'horizon-left'],
        resolve: ({ handlers, classId }) => handlers.getAttendanceStreakCard(classId)
    },
    {
        type: 'attendance_summary',
        family: 'attendance',
        sizeTier: 'compact',
        preferredZones: ['harbor-left', 'sky-left'],
        resolve: ({ handlers, classId }) => handlers.getClassAttendanceCard(classId)
    },
    {
        type: 'school_avg_attendance',
        family: 'attendance',
        sizeTier: 'compact',
        preferredZones: ['harbor-left', 'sky-left'],
        resolve: ({ handlers }) => handlers.getSchoolAttendanceCard()
    },
    {
        type: 'class_bounty',
        family: 'progress',
        sizeTier: 'standard',
        preferredZones: ['horizon-left', 'harbor-left'],
        resolve: ({ handlers, classId }) => handlers.getClassBountyCard(classId)
    },
    {
        type: 'season_visual',
        family: 'atmosphere',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'sky-left'],
        resolve: ({ handlers }) => handlers.getSeasonalCard()
    },
    {
        type: 'weather',
        family: 'atmosphere',
        sizeTier: 'compact',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getWeatherCard()
    },
    {
        type: 'motivation_poster',
        family: 'atmosphere',
        sizeTier: 'feature',
        preferredZones: ['sky-left', 'horizon-left'],
        resolve: ({ handlers, questLevel }) => handlers.getMotivationCard(questLevel)
    },
    {
        type: 'fun_english_phrase',
        family: 'context',
        sizeTier: 'standard',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers, questLevel }) => handlers.getFunEnglishPhraseCard(questLevel)
    },
    {
        type: 'context_morning',
        family: 'context',
        sizeTier: 'compact',
        preferredZones: ['sky-left', 'sky-right'],
        resolve: ({ handlers, questLevel }) => handlers.getContextCard('morning', questLevel)
    },
    {
        type: 'context_afternoon',
        family: 'context',
        sizeTier: 'compact',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers, questLevel }) => handlers.getContextCard('afternoon', questLevel)
    },
    {
        type: 'context_night',
        family: 'context',
        sizeTier: 'compact',
        preferredZones: ['sky-right', 'sky-left'],
        resolve: ({ handlers, questLevel }) => handlers.getContextCard('night', questLevel)
    },
    {
        type: 'context_monday',
        family: 'context',
        sizeTier: 'compact',
        preferredZones: ['horizon-left', 'sky-left'],
        resolve: ({ handlers, questLevel }) => handlers.getContextCard('monday', questLevel)
    },
    {
        type: 'context_friday',
        family: 'context',
        sizeTier: 'compact',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers, questLevel }) => handlers.getContextCard('friday', questLevel)
    },
    {
        type: 'timekeeper',
        family: 'timekeeping',
        sizeTier: 'standard',
        preferredZones: ['horizon-left', 'harbor-left'],
        resolve: ({ handlers, classId }) => handlers.getTimekeeperCard(classId)
    },
    {
        type: 'next_lesson',
        family: 'timekeeping',
        sizeTier: 'compact',
        preferredZones: ['harbor-right', 'horizon-right'],
        resolve: ({ handlers, classId }) => handlers.getNextLessonCard(classId)
    },
    {
        type: 'class_test_luck',
        family: 'timekeeping',
        sizeTier: 'feature',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers, classId, questLevel }) => handlers.getTestLuckCard(classId, questLevel)
    },
    {
        type: 'holiday',
        family: 'calendar',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'sky-left'],
        resolve: ({ handlers }) => handlers.getNextHolidayCard()
    },
    {
        type: 'pre_holiday_hype',
        family: 'calendar',
        sizeTier: 'feature',
        preferredZones: ['sky-left', 'sky-right'],
        resolve: ({ handlers }) => handlers.getPreHolidayHypeCard()
    },
    {
        type: 'post_holiday_welcome',
        family: 'calendar',
        sizeTier: 'standard',
        preferredZones: ['harbor-left', 'sky-left'],
        resolve: ({ handlers }) => handlers.getPostHolidayWelcomeCard()
    },
    {
        type: 'school_upcoming_event',
        family: 'calendar',
        sizeTier: 'compact',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getSchoolUpcomingEventCard()
    },
    {
        type: 'upcoming_test_countdown',
        family: 'calendar',
        sizeTier: 'standard',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers, classId, questLevel }) => handlers.getUpcomingTestCountdownCard(classId, questLevel)
    },
    {
        type: 'school_leader_top3',
        family: 'leaderboards',
        sizeTier: 'standard',
        preferredZones: ['horizon-right', 'harbor-right'],
        resolve: ({ handlers }) => handlers.getSchoolLeaderboardCard()
    },
    {
        type: 'school_top_student',
        family: 'leaderboards',
        sizeTier: 'standard',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers }) => handlers.getSchoolTopStudentCard()
    },
    {
        type: 'school_gold_leader',
        family: 'leaderboards',
        sizeTier: 'compact',
        preferredZones: ['harbor-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getSchoolGoldLeaderCard()
    },
    {
        type: 'class_rank_vs_school',
        family: 'leaderboards',
        sizeTier: 'standard',
        preferredZones: ['horizon-right', 'harbor-right'],
        resolve: ({ handlers, classId }) => handlers.getClassRankVsSchoolCard(classId)
    },
    {
        type: 'class_gold_ranking',
        family: 'leaderboards',
        sizeTier: 'standard',
        preferredZones: ['harbor-right', 'horizon-right'],
        resolve: ({ handlers, classId }) => handlers.getClassGoldRankingCard(classId)
    },
    {
        type: 'class_gold_top_trio',
        family: 'leaderboards',
        sizeTier: 'feature',
        preferredZones: ['harbor-right', 'horizon-right'],
        resolve: ({ handlers, classId }) => handlers.getClassGoldTopTrioCard(classId)
    },
    {
        type: 'guild_leaderboard',
        family: 'guilds',
        sizeTier: 'feature',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers }) => handlers.getGuildLeaderboardCard()
    },
    {
        type: 'class_familiar_parade',
        family: 'familiars',
        sizeTier: 'feature',
        preferredZones: ['harbor-left', 'horizon-left'],
        resolve: ({ handlers, classId }) => handlers.getClassFamiliarParadeCard(classId)
    },
    {
        type: 'class_familiar_hatch_watch',
        family: 'familiars',
        sizeTier: 'standard',
        preferredZones: ['harbor-left', 'sky-left'],
        resolve: ({ handlers, classId }) => handlers.getClassFamiliarHatchWatchCard(classId)
    },
    {
        type: 'league_race',
        family: 'leaderboards',
        sizeTier: 'compact',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers }) => handlers.getRandomLeagueRaceCard()
    },
    {
        type: 'school_active_bounties',
        family: 'progress',
        sizeTier: 'compact',
        preferredZones: ['horizon-left', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getSchoolActiveBountiesCard()
    },
    {
        type: 'school_adventure_count',
        family: 'narrative',
        sizeTier: 'compact',
        preferredZones: ['harbor-left', 'horizon-left'],
        resolve: ({ handlers }) => handlers.getSchoolAdventureCountCard()
    },
    {
        type: 'giant_clock',
        family: 'timekeeping',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'sky-left'],
        resolve: ({ handlers }) => handlers.getGiantClockCard()
    },
    {
        type: 'ai_fact_science',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('fact_science')
    },
    {
        type: 'ai_fact_history',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('fact_history')
    },
    {
        type: 'ai_fact_nature',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('fact_nature')
    },
    {
        type: 'ai_fact_geography',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('fact_geography')
    },
    {
        type: 'ai_fact_math',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('fact_math')
    },
    {
        type: 'ai_did_you_know',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('did_you_know')
    },
    {
        type: 'ai_joke',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('joke')
    },
    {
        type: 'ai_riddle',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('riddle')
    },
    {
        type: 'ai_brain_teaser',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('brain_teaser')
    },
    {
        type: 'ai_word',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('word')
    },
    {
        type: 'ai_idiom',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'horizon-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('idiom')
    },
    {
        type: 'ai_tongue_twister',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers }) => handlers.getAIFromDB('tongue_twister')
    },
    {
        type: 'this_day_history',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'sky-left'],
        resolve: ({ handlers, questLevel }) => handlers.getThisDayInHistoryCard(questLevel)
    },
    {
        type: 'world_record',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['sky-right', 'sky-left'],
        resolve: ({ handlers, questLevel }) => handlers.getWorldRecordCard(questLevel)
    },
    {
        type: 'study_tip',
        family: 'knowledge',
        sizeTier: 'standard',
        preferredZones: ['horizon-left', 'sky-left'],
        resolve: ({ handlers, questLevel }) => handlers.getStudyTipCard(questLevel)
    },
    {
        type: 'thought_experiment',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['horizon-left', 'sky-left'],
        resolve: ({ handlers, questLevel }) => handlers.getThoughtExperimentCard(questLevel)
    },
    {
        type: 'emoji_riddle',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers, questLevel }) => handlers.getEmojiRiddleCard(questLevel)
    },
    {
        type: 'math_challenge',
        family: 'knowledge',
        sizeTier: 'feature',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers, questLevel }) => handlers.getMathChallengeCard(questLevel)
    },
    {
        type: 'greek_nameday_today',
        family: 'calendar',
        sizeTier: 'compact',
        preferredZones: ['sky-left', 'horizon-left'],
        resolve: ({ handlers }) => handlers.getGreekNamedayCard()
    },
    {
        type: 'orthodox_calendar',
        family: 'calendar',
        sizeTier: 'compact',
        preferredZones: ['sky-left', 'horizon-left'],
        resolve: ({ handlers }) => handlers.getOrthodoxCalendarCard()
    },
    {
        type: 'story_sentence',
        family: 'narrative',
        sizeTier: 'feature',
        preferredZones: ['harbor-left', 'horizon-left'],
        resolve: ({ handlers, classId }) => handlers.getStoryCard(classId, 'text')
    },
    {
        type: 'absent_heroes',
        family: 'attendance',
        sizeTier: 'compact',
        preferredZones: ['harbor-left', 'horizon-left'],
        resolve: ({ handlers, classId }) => handlers.getAbsentHeroesCard(classId)
    },
    {
        type: 'mindfulness',
        family: 'wellness',
        sizeTier: 'feature',
        preferredZones: ['harbor-left', 'horizon-left'],
        resolve: ({ handlers, questLevel }) => handlers.getMindfulnessCard(questLevel)
    },
    {
        type: 'quest_map_position',
        family: 'progress',
        sizeTier: 'feature',
        preferredZones: ['horizon-left', 'sky-left'],
        resolve: ({ handlers, classId }) => handlers.getQuestMapPositionCard(classId)
    },
    {
        type: 'reigning_hero_spotlight',
        family: 'achievements',
        sizeTier: 'feature',
        preferredZones: ['horizon-left', 'harbor-left'],
        resolve: ({ handlers, classId }) => handlers.getReigningHeroCard(classId)
    },
    {
        type: 'lesson_milestone',
        family: 'achievements',
        sizeTier: 'standard',
        preferredZones: ['horizon-left', 'harbor-left'],
        resolve: ({ handlers, classId }) => handlers.getLessonMilestoneCard(classId)
    },
    {
        type: 'class_season_snapshot',
        family: 'progress',
        sizeTier: 'standard',
        preferredZones: ['harbor-right', 'horizon-right'],
        resolve: ({ handlers, classId }) => handlers.getClassSeasonSnapshotCard(classId)
    }
];

const prefixDefinitions = [
    {
        prefix: 'stu_spotlight',
        family: 'spotlight',
        sizeTier: 'feature',
        preferredZones: ['horizon-left', 'sky-left'],
        resolve: ({ handlers, questLevel, dataId }) => handlers.getStudentSpotlightCard(dataId, questLevel)
    },
    {
        prefix: 'stu_funfact',
        family: 'spotlight',
        sizeTier: 'standard',
        preferredZones: ['horizon-left', 'harbor-left'],
        resolve: ({ handlers, classId, questLevel, dataId }) => handlers.getStudentFunFactCard(dataId, classId, questLevel)
    },
    {
        prefix: 'log',
        family: 'narrative',
        sizeTier: 'feature',
        preferredZones: ['harbor-left', 'harbor-right'],
        resolve: ({ handlers, dataId }) => handlers.getSpecificLogCard(dataId)
    },
    {
        prefix: 'top_student_monthly',
        family: 'achievements',
        sizeTier: 'feature',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers, classId, dataId }) => handlers.getTopMonthlyStudentCard(classId, dataId)
    },
    {
        prefix: 'top_student_daily',
        family: 'achievements',
        sizeTier: 'standard',
        preferredZones: ['horizon-right', 'sky-right'],
        resolve: ({ handlers, classId, dataId }) => handlers.getTopDailyStudentCard(classId, dataId)
    },
    {
        prefix: 'recent_award',
        family: 'awards',
        sizeTier: 'feature',
        preferredZones: ['horizon-left', 'harbor-left'],
        resolve: ({ handlers, classId, dataId }) => handlers.getRecentAwardCard(classId, dataId)
    },
    {
        prefix: 'bday',
        family: 'awards',
        sizeTier: 'feature',
        preferredZones: ['sky-left', 'harbor-left'],
        resolve: ({ handlers, dataId }) => handlers.getBirthdayCard(dataId)
    },
    {
        prefix: 'name',
        family: 'awards',
        sizeTier: 'standard',
        preferredZones: ['sky-left', 'horizon-left'],
        resolve: ({ handlers, dataId }) => handlers.getNamedayCard(dataId)
    }
];

export function createWallpaperCardRegistry(handlers = {}) {
    const exactMap = new Map(exactDefinitions.map((definition) => [definition.type, definition]));

    function getDefinition(type) {
        if (exactMap.has(type)) return exactMap.get(type);
        const [baseType] = String(type || '').split(':');
        return prefixDefinitions.find((definition) => definition.prefix === baseType) || null;
    }

    async function hydrate(type, context = {}) {
        const definition = getDefinition(type);
        if (!definition) return null;

        const [baseType, dataId] = String(type || '').split(':');
        const card = await definition.resolve({
            ...context,
            baseType,
            dataId,
            handlers,
            type
        });

        return withMeta(card, definition);
    }

    return {
        getDefinition,
        hydrate
    };
}