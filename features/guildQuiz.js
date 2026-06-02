// features/guildQuiz.js — Quiz question pools (level-appropriate), randomisation, guild assignment

import { GUILD_IDS } from './guilds.js';

export const QUIZ_QUESTION_COUNT = 7;

/** Fisher-Yates shuffle — returns a new shuffled array. */
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ─── Pool 1: Junior A ────────────────────────────────────────────────────────
// Pre-A1 │ Ages 7–8 │ Very short options (2–4 words), picture-book vocabulary

const POOL_JUNIOR_A = [
    { id: 'ja01', emoji: '💪', question: 'When something is hard, I…', options: [
        { text: '🔁 Try again and again!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
        { text: '🤝 Ask a friend to help', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Think first', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🐉 Just do it!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja02', emoji: '🐾', question: 'My favourite animal is…', options: [
        { text: '🐉 A dragon — strong and cool!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🐻 A bear — big and friendly', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🦉 An owl — clever and quiet', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🦅 An eagle — free and brave', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja03', emoji: '🎮', question: 'I like to play…', options: [
        { text: '🏃 Fast, exciting games!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤸 Games with my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧩 Puzzles and quizzes', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏆 Games I can win!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
    ]},
    { id: 'ja04', emoji: '🌈', question: 'My favourite colour is…', options: [
        { text: '🔥 Red or orange', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🍂 Brown or yellow', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💜 Blue or purple', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '✨ Pink or gold', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'ja05', emoji: '🦸', question: 'My superpower would be…', options: [
        { text: '💥 Super strength!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Making everyone happy', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Knowing all the answers', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🦅 Flying!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'ja06', emoji: '📖', question: 'I like stories about…', options: [
        { text: '⚔️ Heroes and adventures!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🐻 Animals and friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 Mysteries and secrets', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Someone who never gives up', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja07', emoji: '😊', question: 'When I make a mistake, I…', options: [
        { text: '😤 Say "No problem!" and go!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤗 Ask a friend what to do', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Think about why it happened', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🔁 Try again right away!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'ja08', emoji: '☀️', question: 'My favourite weather is…', options: [
        { text: '☀️ Hot and sunny — let\'s go outside!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🌤️ Warm and cosy', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '☁️ Cool and cloudy — great for reading', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '🪁 Windy — perfect for flying kites!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'ja09', emoji: '🏖️', question: 'On the weekend I like to…', options: [
        { text: '🎢 Do something exciting!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤸 Play with my best friend', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎨 Read or draw', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '🆕 Try something new', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'ja10', emoji: '🌟', question: 'The best thing about school is…', options: [
        { text: '🙋 Showing what I can do!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤸 Playing with my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 Learning new things', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '📈 Getting better every day', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja11', emoji: '🎁', question: 'The best gift is…', options: [
        { text: '🎺 Something I can show to everyone!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🎲 A game to play with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 A book or puzzle', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '📈 Something that helps me improve', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'ja12', emoji: '🦁', question: 'I am more like…', options: [
        { text: '🦁 A lion — loud and brave!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🐕 A dog — kind and loyal', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🦉 An owl — quiet and smart', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🦋 A butterfly — beautiful and free', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja13', emoji: '🏫', question: 'In a group activity, I like to…', options: [
        { text: '👑 Be the leader!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Help everyone', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Have all the ideas', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏁 Make sure we finish!', guildWeights: { phoenix_rising: 2, owl_wisdom: 1 } },
    ]},
    { id: 'ja14', emoji: '😨', question: 'When I\'m scared, I…', options: [
        { text: '😤 Say "I\'m not scared!" and go!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Hold my friend\'s hand', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Think about it first', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '🌬️ Take a deep breath and try', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'ja15', emoji: '🏆', question: 'If I win a prize, I…', options: [
        { text: '🎉 Am SO happy and show everyone!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Share it with my team', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Think about how I won', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '💪 Work even harder next time', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'ja16', emoji: '🔮', question: 'My magic wand can…', options: [
        { text: '🔥 Shoot fire!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '😄 Make everyone happy', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '❓ Answer any question', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '✨ Fix anything that\'s broken', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja17', emoji: '🌊', question: 'At the beach I like to…', options: [
        { text: '🏄 Run into the waves!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🏖️ Play with everyone', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔎 Look for shells and rocks', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏊 Swim as far as I can!', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja18', emoji: '🎨', question: 'When I draw, I draw…', options: [
        { text: '🔥 Fire and action!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '👨‍👩‍👧 My friends and family', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🗺️ Maps and inventions', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌈 Wings and the sky', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja19', emoji: '🧁', question: 'When I grow up, I want to be…', options: [
        { text: '🦸 A hero everyone knows!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 A great friend to everyone', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Very, very clever', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Someone who never gives up', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja20', emoji: '⭐', question: 'I love English because…', options: [
        { text: '🙋 I can show what I know!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '💬 I can talk to my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 I learn new words every day', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📈 I get better and better', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja21', emoji: '🎭', question: 'In a class play I want to be…', options: [
        { text: '🦸 The hero!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 The best friend who helps everyone', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧙 The wise old character', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏆 The one who wins in the end', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja22', emoji: '🌺', question: 'A good day is when…', options: [
        { text: '🌟 I do something amazing!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 I help someone', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 I learn something cool', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 I try something that was hard', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja23', emoji: '🍀', question: 'I am lucky because I am…', options: [
        { text: '💪 Brave!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Kind to everyone', guildWeights: { grizzly_might: 2, phoenix_rising: 1 } },
        { text: '🧠 Smart', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌟 Strong inside', guildWeights: { phoenix_rising: 2, owl_wisdom: 1 } },
    ]},
    { id: 'ja24', emoji: '🌍', question: 'The world needs more…', options: [
        { text: '🦸 Heroes!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Kindness', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 Knowledge', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '✨ Hope', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja25', emoji: '🌤️', question: 'I feel happy when I…', options: [
        { text: '🌟 Do something amazing!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '😄 Make my friends smile', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 Find out something new', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏆 Finish something difficult', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja26', emoji: '🎠', question: 'My dream trip is…', options: [
        { text: '🌿 A jungle adventure!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '👨‍👩‍👧 A trip with all my family', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🏛️ A museum in a big city', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🗺️ Somewhere I\'ve never been!', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja27', emoji: '🧪', question: 'Science is fun because…', options: [
        { text: '💥 You can make things explode!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 You can do it with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 You find answers to questions', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🔬 You keep trying until it works', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja28', emoji: '🎯', question: 'What I want most is…', options: [
        { text: '🥇 To be the best!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Good friends forever', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 To know everything!', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 To never stop growing', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja29', emoji: '🌙', question: 'Before I sleep, I like to…', options: [
        { text: '🌟 Talk about the exciting things I did', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '👨‍👩‍👧 Chat with my family', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 Read a book', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '💭 Think about tomorrow', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'ja30', emoji: '🐠', question: 'I would rather be…', options: [
        { text: '🦈 A shark — fast and powerful!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🐬 A dolphin — playful with friends', guildWeights: { grizzly_might: 2, phoenix_rising: 1 } },
        { text: '🐢 A wise sea turtle', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🐟 A salmon — always swimming upstream', guildWeights: { phoenix_rising: 2, owl_wisdom: 1 } },
    ]},
    { id: 'ja31', emoji: '🎶', question: 'I like music that is…', options: [
        { text: '🎸 Loud and exciting!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🎷 Happy and fun to dance to', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎻 Soft and beautiful', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '⚡ Full of energy — it makes me want to go!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'ja32', emoji: '🦋', question: 'If I could fly, I would go to…', options: [
        { text: '🏔️ The highest mountain!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🌍 Visit all my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '☁️ A library in the clouds', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌅 Places I\'ve never seen', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja33', emoji: '🌿', question: 'I am like a plant because…', options: [
        { text: '🌱 I grow fast!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🌸 I am always near my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🌻 I love sunshine and learning', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌿 Even when I\'m cut, I grow back', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja34', emoji: '🧸', question: 'My best toy would be…', options: [
        { text: '🚀 Something exciting, like a rocket!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🎲 A toy for playing with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧩 A big puzzle or smart game', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🔧 Something I can build myself', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'ja35', emoji: '✨', question: 'My motto could be…', options: [
        { text: '🔥 "Be brave — go for it!"', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 "Friends are everything!"', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 "Always keep learning!"', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 "Never, ever give up!"', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
];

// ─── Pool 2: Junior B ────────────────────────────────────────────────────────
// Pre-A1 → A1 │ Ages 8–9 │ Short options (3–6 words), simple A1 vocabulary

const POOL_JUNIOR_B = [
    { id: 'jb01', emoji: '💪', question: 'When something is hard, I usually…', options: [
        { text: '🔁 Try again and again!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
        { text: '🤝 Ask a friend to help me', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Stop and think first', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🐉 Jump in and try!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb02', emoji: '🐾', question: 'If I were an animal, I would be…', options: [
        { text: '🐉 A dragon — brave and strong!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🐻 A bear — big and kind', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🦉 An owl — wise and quiet', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🦅 An eagle — free and fast', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb03', emoji: '🎮', question: 'My favourite game is…', options: [
        { text: '⚡ Something fast and exciting!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤸 A game with my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧩 A puzzle or quiz game', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏆 A game where I can win!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb04', emoji: '🌈', question: 'My favourite colour is…', options: [
        { text: '🔥 Bright red or orange', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🍂 Warm brown or yellow', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💜 Deep blue or purple', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '✨ Shiny pink or gold', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb05', emoji: '🦸', question: 'If I had a superpower, I would…', options: [
        { text: '💥 Have super strength!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🌈 Make everyone around me happy', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Know the answer to everything', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🦅 Fly and never fall down', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb06', emoji: '📖', question: 'I like books and stories about…', options: [
        { text: '⚔️ Heroes and big adventures!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🐾 Animals and good friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 Mysteries and clever secrets', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Someone who never, ever gives up', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb07', emoji: '😊', question: 'When I make a mistake, I…', options: [
        { text: '😤 Say "OK!" and try again!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤗 Ask my friend for help', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Think about what went wrong', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🔁 Try again right away', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb08', emoji: '☀️', question: 'I love when the weather is…', options: [
        { text: '☀️ Hot and sunny — let\'s go!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🌤️ Warm and nice outside', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '☁️ Cool and cloudy — good for books', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '🌬️ Windy — great for running!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb09', emoji: '🏖️', question: 'At the weekend I like to…', options: [
        { text: '🎢 Do something really exciting!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤸 Play with my good friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎨 Read, draw or build things', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '🆕 Try something I never did', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb10', emoji: '🌟', question: 'The best thing about school is…', options: [
        { text: '🙋 I can show what I can do!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '😄 I see and play with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 I learn new and cool things', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '📈 I get better every week', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb11', emoji: '🎁', question: 'The best present is…', options: [
        { text: '🎺 Something I can show everyone!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🎲 A fun game to share', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 A great book or puzzle', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '📈 Something that helps me get better', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb12', emoji: '🦁', question: 'I think I am more like…', options: [
        { text: '🦁 A lion — brave and bold!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🐕 A dog — friendly and loyal', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🦉 An owl — quiet and clever', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🦋 A butterfly — free and hopeful', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb13', emoji: '🏫', question: 'When I work in a group, I…', options: [
        { text: '👑 Like to be the leader!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Like to help everyone', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Come up with the best ideas', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏁 Make sure we all finish', guildWeights: { phoenix_rising: 2, owl_wisdom: 1 } },
    ]},
    { id: 'jb14', emoji: '😨', question: 'When I feel scared, I…', options: [
        { text: '😤 Say "I can do it!" and go!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Stay close to a good friend', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Think about it carefully first', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '🌬️ Breathe in deep and try', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb15', emoji: '🏆', question: 'If I win something, I…', options: [
        { text: '🎉 Am very happy and tell everyone!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Share the good news with my team', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Think about how I did it', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '💪 Work even harder next time', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb16', emoji: '🔮', question: 'If I had a magic power, I would…', options: [
        { text: '🔥 Make fire and be very strong!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '😄 Make all my friends smile', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '❓ Know the answer to any question', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '✨ Fix anything broken or lost', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb17', emoji: '🌊', question: 'At the beach I love to…', options: [
        { text: '🏄 Jump into the big waves!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🏖️ Play and run with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔎 Look for shells and interesting rocks', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏊 Swim out as far as I can!', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb18', emoji: '🎨', question: 'When I draw, I like to draw…', options: [
        { text: '🔥 Battles, fire and action!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '👨‍👩‍👧 My friends and my family', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🗺️ Maps, inventions and cool places', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌈 Wings, the sky and stars', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb19', emoji: '🧁', question: 'When I grow up, I want to be…', options: [
        { text: '🦸 A famous hero or champion!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Someone who helps everyone', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 A very, very clever person', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Someone who never, ever gives up', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb20', emoji: '⭐', question: 'I like learning English because…', options: [
        { text: '🙋 I can show everyone what I know!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '💬 I can talk to my friends in English', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 I learn lots of new words', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📈 I can see I am getting better', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb21', emoji: '🎭', question: 'In a class play I want to be…', options: [
        { text: '🦸 The main hero, of course!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 The kind friend who helps everyone', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧙 The wise and clever character', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏆 The person who wins in the end', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb22', emoji: '🌺', question: 'A really good day is when I…', options: [
        { text: '🌟 Do something really amazing!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Help a friend who needs me', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Learn something really interesting', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Finish something that was very hard', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb23', emoji: '🍀', question: 'I feel good because I am…', options: [
        { text: '💪 Brave and not scared!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Kind and good to everyone', guildWeights: { grizzly_might: 2, phoenix_rising: 1 } },
        { text: '🧠 Smart and always learning', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌟 Strong inside my heart', guildWeights: { phoenix_rising: 2, owl_wisdom: 1 } },
    ]},
    { id: 'jb24', emoji: '🌍', question: 'The world needs more…', options: [
        { text: '🦸 Brave and strong heroes!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 People who are kind and caring', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 People who love to learn', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '✨ People who never stop hoping', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb25', emoji: '🌤️', question: 'I feel very happy when I…', options: [
        { text: '🌟 Do something I am proud of!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '😄 Make all my friends laugh', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 Find out something new and cool', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏆 Finish something that was hard', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb26', emoji: '🎠', question: 'My perfect trip would be…', options: [
        { text: '🌿 A big, exciting adventure!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '👨‍👩‍👧 A trip with my whole family', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🏛️ Visiting a museum or cool city', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🗺️ Going somewhere totally new!', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb27', emoji: '🧪', question: 'Science is my favourite because…', options: [
        { text: '💥 You can make cool explosions!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 You do experiments with your friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 You find out how things really work', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🔬 You keep trying until it works!', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb28', emoji: '🎯', question: 'The most important thing to me is…', options: [
        { text: '🥇 Being the very best I can be!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Having really good friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 Learning as much as I can', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 Always growing and improving', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb29', emoji: '🌙', question: 'Before I go to sleep, I like to…', options: [
        { text: '🌟 Think about the great things I did!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '👨‍👩‍👧 Talk and laugh with my family', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 Read a good book', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '💭 Think about my plans for tomorrow', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb30', emoji: '🐠', question: 'If I were a sea creature, I would be…', options: [
        { text: '🦈 A shark — fast and very strong!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🐬 A dolphin — playful and friendly', guildWeights: { grizzly_might: 2, phoenix_rising: 1 } },
        { text: '🐢 A sea turtle — old and very wise', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🐟 A salmon — always swimming upstream', guildWeights: { phoenix_rising: 2, owl_wisdom: 1 } },
    ]},
    { id: 'jb31', emoji: '🎶', question: 'The music I love most is…', options: [
        { text: '🎸 Very loud and really exciting!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🎷 Happy songs I can dance to', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎻 Soft and very beautiful music', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '⚡ Fast music with lots of energy!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'jb32', emoji: '🦋', question: 'If I could fly anywhere, I would go to…', options: [
        { text: '🏔️ The very highest mountain top!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🌍 Visit all of my best friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '☁️ A library way up in the clouds', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌅 A place I have never seen before', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb33', emoji: '🌿', question: 'I am a bit like a tree because…', options: [
        { text: '🌱 I grow very, very fast!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🌸 I love being close to my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🌻 I need lots of light and learning', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌿 I always come back after a storm', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb34', emoji: '🧸', question: 'My perfect toy would be…', options: [
        { text: '🚀 Something exciting, like a spaceship!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🎲 A game I can play with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧩 A really big and clever puzzle', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🔧 Something I can build by myself', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'jb35', emoji: '✨', question: 'My favourite word is…', options: [
        { text: '🔥 "Brave!"', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 "Friends!"', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 "Learn!"', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 "Try again!"', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
];

// ─── Pool 3: Level A ─────────────────────────────────────────────────────────
// A1+ │ Ages 10–12 │ Options 5–8 words, A1/A2 vocabulary, familiar topics

const POOL_LEVEL_A = [
    { id: 'la01', emoji: '💪', question: 'When something is difficult, I…', options: [
        { text: '🔁 Keep trying until I get it!', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
        { text: '🤝 Ask a friend or teacher for help', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Stop and think about it carefully', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🐉 Jump in and give it my best!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
    ]},
    { id: 'la02', emoji: '📖', question: 'My favourite type of story is…', options: [
        { text: '⚔️ Full of action and adventure!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🐾 About friendship and animals', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 A mystery with things to discover', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌟 About someone who never gives up', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la03', emoji: '🎓', question: 'In class I like to…', options: [
        { text: '✋ Be the first to answer!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Help my classmates when they struggle', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 Read and find new words to learn', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '💪 Keep trying even when it is hard', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la04', emoji: '🦸', question: 'My dream job is…', options: [
        { text: '🌍 Something exciting, like an explorer!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🏥 Something that helps other people', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔬 Something scientific or creative', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📈 Something where I improve every day', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la05', emoji: '🌟', question: 'The best thing about learning English is…', options: [
        { text: '🌟 I can show everyone what I can do!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '😄 I can talk and laugh with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 I learn about new ideas and words', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📈 I can see I am getting better', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la06', emoji: '😊', question: 'When I make a mistake, I…', options: [
        { text: '✅ Correct it and keep going!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Ask someone to help me understand', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Think about what went wrong', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '💪 Try again until I get it right', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'la07', emoji: '🏫', question: 'When I work in a group, I…', options: [
        { text: '📋 Lead and organise the team', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤗 Make sure everyone feels included', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Come up with creative ideas', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Keep going when things get hard', guildWeights: { phoenix_rising: 2, owl_wisdom: 1 } },
    ]},
    { id: 'la08', emoji: '🏆', question: 'My biggest strength is…', options: [
        { text: '🦁 I\'m brave and not afraid to try', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 I\'m a loyal and kind friend', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 I\'m curious and love to learn', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 I never let a failure stop me', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la09', emoji: '🏖️', question: 'At the weekend I like to…', options: [
        { text: '🎢 Do something exciting and new!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤸 Spend time with my good friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 Read, draw or learn something cool', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '🎯 Work on a goal I set for myself', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'la10', emoji: '💬', question: 'A really good friend…', options: [
        { text: '🎉 Always makes things exciting!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Is always there when you need them', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Gives you really good advice', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Pushes you to be better', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la11', emoji: '🌺', question: 'I feel happy and proud when I…', options: [
        { text: '🌟 Do something great in front of others!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '😄 Make all my friends smile', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 Learn something I didn\'t know before', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏆 Finish something really difficult', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la12', emoji: '🦸', question: 'My superpower would be…', options: [
        { text: '💨 Super strength and super speed!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🌈 Making everyone around me happy', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Knowing the answer to anything', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🦅 Getting up after any fall', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'la13', emoji: '🌍', question: 'The world needs people who…', options: [
        { text: '🦸 Lead others and are not afraid', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Care for and support each other', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔬 Learn, discover and teach others', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Never stop working to improve things', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la14', emoji: '🎁', question: 'The best gift is…', options: [
        { text: '🎢 An exciting new experience!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Time with people I love', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 A great book, game or puzzle', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🎯 Something to help me reach my goals', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la15', emoji: '🔮', question: 'I want to be known as…', options: [
        { text: '🦁 Brave and bold — someone who acts', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Kind and caring — always helpful', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Clever and curious — always learning', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 The one who never gave up', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la16', emoji: '🎮', question: 'My favourite type of game is…', options: [
        { text: '⚡ Fast and exciting action games!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🎲 Multiplayer games with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧩 Strategy and puzzle games', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🔝 Games that get harder as you progress', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la17', emoji: '🧠', question: 'I learn best when…', options: [
        { text: '🏆 There is a challenge or a competition!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 I work with people I really like', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 I can explore the topic in depth', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📈 I can see my progress clearly', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la18', emoji: '🌟', question: 'My goal this year is…', options: [
        { text: '🥇 To be the best in my class!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 To make really great friendships', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 To learn as much as possible', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📈 To truly improve my weak points', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la19', emoji: '🧪', question: 'My favourite thing about science is…', options: [
        { text: '💥 Doing exciting experiments!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Working on experiments with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔎 Finding out how things really work', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🔬 Trying again until you get it right', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la20', emoji: '🏃', question: 'When my team is struggling, I…', options: [
        { text: '📣 Take the lead and push forward!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🌈 Cheer them up and encourage them', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔎 Try to find out what the problem is', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🌄 Remind them how far we have come', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la21', emoji: '🎭', question: 'In an English lesson I…', options: [
        { text: '🗣️ Speak out and take risks', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Help quieter classmates', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📝 Try hard to use new words correctly', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Push myself even when it is hard', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la22', emoji: '🎠', question: 'My dream trip would be…', options: [
        { text: '🌿 A big jungle or mountain adventure!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '👨‍👩‍👧 A trip with the people I love', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🏛️ A museum or amazing historical place', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🗺️ Somewhere I have never ever been!', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la23', emoji: '📚', question: 'My favourite school subject is…', options: [
        { text: '🏃 PE or Drama — I love the action!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🎨 Art, music or group projects', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔬 Science, Maths or English', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📈 Any subject where I can see progress', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la24', emoji: '🌙', question: 'The best lesson I have learned is…', options: [
        { text: '🦁 "Be brave — life rewards bravery!"', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 "You can\'t really succeed alone"', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 "Always keep learning something new"', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌄 "Every mistake helps you get better"', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la25', emoji: '🦁', question: 'I am most like…', options: [
        { text: '🦁 A lion — bold and full of energy', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🐻 A bear — warm, strong and loyal', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🦉 An owl — thoughtful, quiet and wise', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🦅 An eagle — always rising again', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la26', emoji: '💡', question: 'I believe the most important thing is…', options: [
        { text: '🔥 Courage and the will to try', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Having people you can trust', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Learning and understanding things', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Never stopping when it is difficult', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la27', emoji: '🌈', question: 'When someone needs help, I…', options: [
        { text: '🏃 Jump in straight away!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤗 Do everything I can to help them', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Give them the best advice I can', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🌄 Help them see things can get better', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la28', emoji: '😤', question: 'My approach to something very difficult is…', options: [
        { text: '⚔️ Go for it! No fear!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '👫 Work on it together with others', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📋 Plan it carefully before I start', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🪜 Break it into small steps', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la29', emoji: '🌅', question: 'I think failure is…', options: [
        { text: '🔥 Something to fight and beat!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Easier when you are not alone', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 A great lesson to learn from', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌄 A normal step on the way to success', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la30', emoji: '🎵', question: 'My favourite type of music is…', options: [
        { text: '🎸 Loud, fast and full of energy!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🎷 Happy songs I can enjoy with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎻 Calm and beautiful music', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '⚡ Powerful music that gives me energy', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'la31', emoji: '🔥', question: 'The most exciting day at school is when…', options: [
        { text: '🥇 I win something or get a great result!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '😄 I laugh and have fun with my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 I learn something that really surprises me', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 I do something I couldn\'t do before', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la32', emoji: '🌿', question: 'I am at my best when…', options: [
        { text: '⚔️ I have a real challenge to beat!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 I work in a great team', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔎 I get to explore a new idea', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 I can feel myself getting better', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la33', emoji: '🏅', question: 'When I think about the future, I…', options: [
        { text: '⚡ Want to do something exciting and big!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Want to be close to people I love', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎓 Want to become an expert at something', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌟 Want to achieve something really great', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'la34', emoji: '🐠', question: 'I am more like…', options: [
        { text: '🦈 A shark — fast, bold and powerful', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🐬 A dolphin — fun, friendly and caring', guildWeights: { grizzly_might: 2, phoenix_rising: 1 } },
        { text: '🐢 A sea turtle — patient and very wise', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🐟 A salmon — always swimming upstream', guildWeights: { phoenix_rising: 2, owl_wisdom: 1 } },
    ]},
    { id: 'la35', emoji: '✨', question: 'My motto for life is…', options: [
        { text: '🦁 "Be bold and brave!"', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 "Together we are stronger!"', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 "Knowledge is power!"', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 "Fall down, get up again!"', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
];

// ─── Pool 4: Level B ─────────────────────────────────────────────────────────
// A2 │ Ages 11–12 │ Options 7–11 words, elementary vocabulary, familiar abstract nouns

const POOL_LEVEL_B = [
    { id: 'lb01', emoji: '💪', question: 'When I face a challenge, I tend to…', options: [
        { text: '🔥 Go for it with confidence and energy', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Ask someone I trust for advice', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Stop and think carefully before acting', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🌱 See it as a chance to improve myself', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb02', emoji: '🌟', question: 'The thing I\'m most proud of at school is…', options: [
        { text: '🌟 My confidence and energy in class', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '👫 The great friendships I have made', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 How well I understand the subject', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📈 How much I have improved this year', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb03', emoji: '📖', question: 'My favourite kind of story is…', options: [
        { text: '🗡️ Full of action, danger and adventure!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 About true friendship and helping others', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔬 A mystery with things to discover', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌟 About someone who overcomes a big problem', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb04', emoji: '🎓', question: 'The best thing about learning English is…', options: [
        { text: '🎤 Showing what I can do in front of others', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '😄 Talking and laughing with other people', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Discovering new ideas and vocabulary', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📈 Seeing how much I improve every week', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb05', emoji: '🏫', question: 'When I\'m in a group, I…', options: [
        { text: '📣 Lead and organise the whole team', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤗 Make sure everyone is included', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Come up with the most creative ideas', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Keep the team going when things get hard', guildWeights: { phoenix_rising: 2, owl_wisdom: 1 } },
    ]},
    { id: 'lb06', emoji: '😊', question: 'When I make a mistake in English, I…', options: [
        { text: '✅ Correct myself and keep going forward', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Ask someone to help me understand it', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📓 Note it down and study it later', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🌱 Think of it as a step towards improving', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'lb07', emoji: '🌙', question: 'My dream for the future is to…', options: [
        { text: '🌟 Be very successful and well-known!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Be surrounded by people I care about', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎓 Become an expert in something I love', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Achieve something I worked really hard for', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb08', emoji: '😤', question: 'When someone doubts my ability, I feel…', options: [
        { text: '🔥 Motivated to prove them completely wrong!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 I talk to someone who believes in me', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 I try to understand why they think that', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '💪 Even more determined and focused', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'lb09', emoji: '🏆', question: 'The word that best describes me is…', options: [
        { text: '🦁 Fearless — I go for things!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Caring — my friends always come first', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 Curious — I love discovering new things', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Resilient — I always come back stronger', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb10', emoji: '⚡', question: 'I feel most energised when I…', options: [
        { text: '🏆 Have a competition or exciting challenge', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🎉 Am having a great time with people I like', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 Am reading or working on a project', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌅 Look back and see how far I have come', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb11', emoji: '🦸', question: 'The quality I want to improve most is…', options: [
        { text: '💪 Being more confident and decisive', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Being a better listener for other people', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧩 Being more careful and analytical', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 Being more patient when things take time', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb12', emoji: '🏖️', question: 'Outside school, I enjoy…', options: [
        { text: '🏄 Sports, gaming or exciting activities', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🎮 Spending quality time with my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎨 Reading, drawing or creating something', guildWeights: { owl_wisdom: 2, grizzly_might: 1 } },
        { text: '🎯 Working towards a personal goal', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'lb13', emoji: '🎭', question: 'In English class, I…', options: [
        { text: '🗣️ Speak out confidently and try new things', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Help quieter classmates when I can', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📝 Focus carefully on using vocabulary correctly', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Keep pushing myself even when it\'s difficult', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb14', emoji: '💡', question: 'I believe the most important thing is…', options: [
        { text: '🔥 Courage and big, bold ambition', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Strong and loyal friendships', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Learning and understanding the world', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 Never giving up when things get hard', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb15', emoji: '🌈', question: 'My perfect day would include…', options: [
        { text: '🎢 Something exciting and totally new', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Quality time with people I really care about', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 Learning or making something creative', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏆 Reaching a goal I set for myself', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb16', emoji: '📚', question: 'The best lesson I have ever learned is…', options: [
        { text: '🦁 "Be bold — life rewards people who try"', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 "You really can\'t succeed completely alone"', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 "Understanding matters more than memorising"', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌄 "Every setback is a chance to come back stronger"', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb17', emoji: '😰', question: 'When I feel stressed, I prefer to…', options: [
        { text: '🏋️ Use the energy to do something productive', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Talk it through with someone I trust', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧩 Work out what is causing it and solve it', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌄 Remember that I have handled hard things before', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb18', emoji: '🌍', question: 'The kind of person I admire most is…', options: [
        { text: '🦸 Someone brave who changed things for the better', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Someone who is always there for others', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎓 Someone always learning and thinking deeply', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Someone who kept going no matter what', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb19', emoji: '🌅', question: 'I believe failure is…', options: [
        { text: '🔥 Something to fight hard and overcome', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Easier to deal with when you are not alone', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 An experience you can really learn from', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 A normal part of improving and growing', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb20', emoji: '🏃', question: 'When my team is struggling, I…', options: [
        { text: '📣 Take the lead and motivate everyone', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🌈 Cheer everyone up and keep spirits high', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔎 Look for the cause of the problem', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🌄 Remind them how far we have already come', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb21', emoji: '🎓', question: 'The best thing school gives me is…', options: [
        { text: '🎤 A place to show what I can really do', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Good friendships and a sense of belonging', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 Knowledge to understand the world around me', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 A chance to grow into who I want to be', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb22', emoji: '🔥', question: 'My attitude to English can best be described as…', options: [
        { text: '🏆 Ambitious — I want to be really good at it', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🌍 Social — it lets me connect with others', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Curious — I find the language itself fascinating', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Determined — I have come far and I won\'t stop', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb23', emoji: '🔮', question: 'When I think about my future, I imagine…', options: [
        { text: '⚡ Something exciting and full of challenges', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 A happy life with the people I love', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎓 A career where I can develop deep knowledge', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌟 A story of real achievement and hard work', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb24', emoji: '👑', question: 'The role I take in a difficult situation is…', options: [
        { text: '👑 I take charge and make quick decisions', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 I keep everyone together and positive', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 I look at the situation very carefully', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 I stay calm and think about the long term', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb25', emoji: '💬', question: 'A good friend always…', options: [
        { text: '🎉 Makes your life more interesting and exciting', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Is always there when you really need them', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Gives you honest and really helpful advice', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Pushes you to be the best version of yourself', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb26', emoji: '🎯', question: 'My approach to a difficult task is…', options: [
        { text: '⚔️ Go for it head-on — no hesitation!', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '👫 Share it with others and work together', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📋 Plan it carefully before I even start', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🪜 Break it into small steps and be patient', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb27', emoji: '🎤', question: 'My favourite way to express myself is…', options: [
        { text: '🎤 Speaking up, performing or debating', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '💬 Talking and really connecting with friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📝 Writing, drawing or making something creative', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏆 Achieving a goal I found difficult to reach', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb28', emoji: '💡', question: 'I think the key to success is…', options: [
        { text: '🔥 Courage and really big ambition', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Strong teamwork and good relationships', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Knowledge and very careful preparation', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Persistence through every single failure', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb29', emoji: '🌱', question: 'My goal for this year is…', options: [
        { text: '🥇 To achieve the absolute best results I can', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 To build strong and lasting friendships', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 To really understand the subject I am studying', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📈 To seriously improve something I find hard', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb30', emoji: '🏛️', question: 'I am most excited by learning about…', options: [
        { text: '🏛️ Powerful people and great moments in history', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 People and how they communicate and get along', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔭 Science and ideas that explain our world', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📜 Stories of people who completely transformed themselves', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb31', emoji: '🤝', question: 'When a friend is struggling, I…', options: [
        { text: '🔥 Try to take action and fix the problem', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Simply be there and give them my full attention', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Offer them practical advice and a fresh view', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🌄 Remind them of their strengths and past successes', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb32', emoji: '👑', question: 'The most important quality in a good leader is…', options: [
        { text: '🦁 The courage to act when things are difficult', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 The ability to understand and unite people', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔭 The intelligence to think clearly and plan ahead', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 The strength to keep going through the hardest times', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb33', emoji: '🌊', question: 'I feel most alive when I…', options: [
        { text: '🌟 Accomplish something difficult that others can see', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Feel truly connected to the people around me', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Discover something I had never understood before', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 Realise I have grown from something that challenged me', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb34', emoji: '🔑', question: 'The most useful thing about making mistakes is…', options: [
        { text: '🔥 They motivate me to prove I can do better', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 They remind me how important it is to have support', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 They show me exactly what I need to work on', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 They are the price of genuine improvement and growth', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'lb35', emoji: '✨', question: 'My motto for life is…', options: [
        { text: '🔥 "Fortune favours the bold!"', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 "Stand together. Stand strong."', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 "Knowledge is power."', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 "Fall down seven, rise up eight."', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
];

// ─── Pool 5: Levels C & D ────────────────────────────────────────────────────
// A1+ │ Ages 10–12 │ Simple vocabulary, shorter sentences, similar to Level A/B

const POOL_LEVEL_CD = [
    { id: 'cd01', emoji: '💪', question: 'When something is hard, I…', options: [
        { text: '🔥 Try harder and use my energy!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Ask my friends for help', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🤔 Think about what went wrong', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🌱 Keep going and look forward', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd02', emoji: '🏫', question: 'In group work, I like to…', options: [
        { text: '👑 Lead the team and get things done', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤗 Make sure everyone helps and feels happy', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Think of ideas and solve problems', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Cheer up the team when they are tired', guildWeights: { phoenix_rising: 2, owl_wisdom: 1 } },
    ]},
    { id: 'cd03', emoji: '🧠', question: 'I learn best when…', options: [
        { text: '🏆 I try to be the best in class', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '👫 I study with my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 I take my time and learn step by step', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 Every hard thing makes me stronger', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd04', emoji: '👑', question: 'A good leader should be…', options: [
        { text: '🦁 Brave and ready to make choices', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Kind and good at listening to others', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔭 Smart and able to plan ahead', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 Strong enough to lead in hard times', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd05', emoji: '🌱', question: 'I grow as a person when…', options: [
        { text: '💥 I work hard to be the best', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 I have good friends who support me', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 I read, study and learn new things', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 I face hard times and keep going', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd06', emoji: '🔮', question: 'I am most like…', options: [
        { text: '🔥 A fire — strong and full of energy', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🌳 A tree — strong with many friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧭 A compass — always showing the right way', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 A river — always moving forward', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd07', emoji: '💬', question: 'When someone says I did something wrong, I…', options: [
        { text: '🦁 Stand tall — I believe in myself', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤗 Think about how others feel', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 Look at it carefully to see if it is true', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '💪 Use it to work harder and do better', guildWeights: { phoenix_rising: 2, dragon_flame: 1 } },
    ]},
    { id: 'cd08', emoji: '💡', question: 'The most important thing to me is…', options: [
        { text: '🦁 Being brave and never giving up', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Being a good friend who helps others', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Being smart and making good choices', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌟 Always hoping things will get better', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd09', emoji: '🎓', question: 'When I grow up, I want to…', options: [
        { text: '👑 Be a leader and help others', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤗 Work with people and make them happy', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔬 Learn a lot and become an expert', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🏗️ Build something important over time', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd10', emoji: '🌍', question: 'I like talking about…', options: [
        { text: '🔥 Fun debates with different ideas', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Personal things with my best friend', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🌍 Big ideas about the world', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌄 How people got through hard times', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd11', emoji: '🌅', question: 'When something bad happens, I say…', options: [
        { text: '🔥 "I am ready — let us go!"', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 "We can do this together!"', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 "What can I learn from this?"', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌄 "This is just one step forward"', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd12', emoji: '🎨', question: 'When I make something creative, I…', options: [
        { text: '🎨 Try new and surprising ideas', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Work with others and share ideas', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📖 Plan carefully before I start', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🔄 Keep working on it until it is great', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd13', emoji: '🌟', question: 'I want people to remember me as…', options: [
        { text: '🌟 Someone who did something amazing', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Someone who helped others', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎓 Someone who knew a lot', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 Someone who never gave up', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd14', emoji: '🎯', question: 'To get better at something, I…', options: [
        { text: '💥 Set big goals and work very hard', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Learn from people I look up to', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎯 Find my weak spots and fix them', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 Practice a little bit every day', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd15', emoji: '🤝', question: 'When my friend is sad, I…', options: [
        { text: '🔥 Try to fix the problem for them', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Stay with them and listen', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Give them advice and new ideas', guildWeights: { owl_wisdom: 2, phoenix_rising: 1 } },
        { text: '🌄 Remind them how strong they are', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd16', emoji: '🏛️', question: 'School helps me by…', options: [
        { text: '🎤 Letting me show what I can do', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Giving me friends and a place to belong', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 Teaching me about the world', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 Helping me become who I want to be', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd17', emoji: '🔭', question: 'I like learning about…', options: [
        { text: '🏛️ Heroes and leaders from history', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 How people think and feel', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔭 Science and how the world works', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '📜 People who beat hard challenges', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd18', emoji: '⚡', question: 'I feel happiest when I…', options: [
        { text: '🌟 Do something hard that others see', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Feel close to my friends and family', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Learn something new', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 Know I have grown from something hard', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd19', emoji: '🦁', question: 'My friends would say I am…', options: [
        { text: '🦁 Brave and say what I think', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Kind and always there for them', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 Curious and love to learn', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 Strong and can bounce back from anything', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd20', emoji: '📖', question: 'Good advice I would give is…', options: [
        { text: '🔥 "Be brave and take action!"', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 "Keep good friends close to you"', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 "Never stop being curious"', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌄 "Every fall helps you rise higher"', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd21', emoji: '📈', question: 'I study hard because…', options: [
        { text: '🔥 I want to do better than before', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 I like learning with my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 I love understanding new things', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 I enjoy beating hard challenges', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd22', emoji: '😤', question: 'When I feel stressed, I…', options: [
        { text: '🏋️ Use the energy to work harder', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Talk to someone I trust', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧩 Figure out what is wrong and fix it', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 Remember I have been through hard times before', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd23', emoji: '🌏', question: 'Great people are great because…', options: [
        { text: '🔥 They are brave and act fast', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 They care about others', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🦉 They see things others miss', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 They never stop trying', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd24', emoji: '🧭', question: 'My life motto is…', options: [
        { text: '🔥 "Be bold and follow your dreams!"', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 "Friends help you succeed"', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 "The more you know, the better"', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌄 "Every fall is a chance to rise"', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd25', emoji: '🚨', question: 'In a difficult situation, I…', options: [
        { text: '👑 Take charge and make decisions', guildWeights: { dragon_flame: 2, grizzly_might: 1 } },
        { text: '🤝 Keep everyone together and happy', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 Look at the problem carefully first', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 Stay calm and think of the future', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd26', emoji: '🔥', question: 'When I love something, I…', options: [
        { text: '💥 Give it all my energy!', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Share it with people I care about', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 Learn everything I can about it', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🎯 Set goals and track my progress', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd27', emoji: '📅', question: 'When I am alone, I like to…', options: [
        { text: '💪 Practice to get better at something', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Check on my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '📚 Read or learn about interesting things', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🎯 Work on my long-term goals', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd28', emoji: '🔑', question: 'I learned that I…', options: [
        { text: '🔥 Work best when there is pressure', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Need friends to do my best', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Need to understand things fully', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 Am stronger than I thought', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd29', emoji: '🌐', question: 'I like learning English because…', options: [
        { text: '🏆 I want to be the very best', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🌍 It helps me talk to more people', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 The language is interesting', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 I have worked hard and will not stop', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd30', emoji: '🏆', question: 'I am proud when I…', options: [
        { text: '🌟 Do something brave and important', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 Help someone who needs it', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '💡 Finally understand something hard', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌄 Do something I thought was impossible', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd31', emoji: '🤔', question: 'A good friendship needs…', options: [
        { text: '🦁 Honesty and respect', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Loyalty — being there no matter what', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 Learning and growing together', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 Supporting each other in hard times', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd32', emoji: '🎖️', question: 'The best kind of success is…', options: [
        { text: '🔥 Doing something brave and risky', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Doing something as a team', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎓 Doing something that needs deep knowledge', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 Doing something that takes years of hard work', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd33', emoji: '💫', question: 'The best thing about me is…', options: [
        { text: '💥 I am bold and take action', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤗 I am loyal to my friends', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🔍 I am curious and love to learn', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌊 I bounce back from hard times', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd34', emoji: '🌿', question: 'To improve myself over time, I…', options: [
        { text: '💥 Set big goals and beat my best', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 Learn from people I respect', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🎯 Find weak spots and fix them', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '🌱 Practice a little every day', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
    { id: 'cd35', emoji: '✨', question: 'My motto for life is…', options: [
        { text: '🔥 "Be brave and strong!"', guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { text: '🤝 "Stand together!"', guildWeights: { grizzly_might: 2, owl_wisdom: 1 } },
        { text: '🧠 "Keep learning!"', guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
        { text: '💪 "Never give up!"', guildWeights: { phoenix_rising: 2, grizzly_might: 1 } },
    ]},
];

// ─── Backward-compat alias & helpers ─────────────────────────────────────────

/** Default quiz question set (Level A pool, used when questLevel is unknown). */
export const SORTING_QUIZ_QUESTIONS = POOL_LEVEL_A;

/**
 * Returns the full age/league-appropriate question pool for the sorting quiz.
 * @param {string} [questLevel] - e.g. "Junior A", "A", "B", "C", "D"
 * @returns {Array}
 */
export function getQuestionsForLevel(questLevel) {
    if (!questLevel) return POOL_LEVEL_A;
    const level = String(questLevel).trim();
    if (level === 'Junior A') return POOL_JUNIOR_A;
    if (level === 'Junior B') return POOL_JUNIOR_B;
    if (level === 'A') return POOL_LEVEL_A;
    if (level === 'B') return POOL_LEVEL_B;
    if (level === 'C' || level === 'D') return POOL_LEVEL_CD;
    return POOL_LEVEL_A;
}

/**
 * Returns a randomly selected, option-shuffled set of questions for the given level.
 * Each call produces a unique, personalised quiz even within the same class.
 * @param {string} [questLevel]
 * @param {number} [count]
 * @returns {Array}
 */
export function getRandomizedQuestionsForLevel(questLevel, count = QUIZ_QUESTION_COUNT) {
    const pool = getQuestionsForLevel(questLevel);
    const shuffledPool = shuffleArray(pool);
    const selected = shuffledPool.slice(0, Math.min(count, shuffledPool.length));
    return selected.map(q => ({ ...q, options: shuffleArray([...q.options]) }));
}

/**
 * Assign guild from quiz answers. Returns guildId with highest weighted score.
 * @param {Array<number>} selectedOptionIndices - Per-question selected option index (0-based)
 * @param {string|null} [classId] - Unused (reserved for future balancing)
 * @param {Array} [questions] - The exact question set shown (defaults to POOL_LEVEL_A)
 * @returns {string} guildId
 */
export function assignGuildFromQuizResults(selectedOptionIndices, classId = null, questions = POOL_LEVEL_A) {
    const scores = { dragon_flame: 0, grizzly_might: 0, owl_wisdom: 0, phoenix_rising: 0 };
    (questions || POOL_LEVEL_A).forEach((q, qIndex) => {
        const choice = selectedOptionIndices[qIndex];
        const option = q.options[choice];
        if (option && option.guildWeights) {
            Object.entries(option.guildWeights).forEach(([gid, w]) => {
                if (GUILD_IDS.includes(gid)) scores[gid] += w;
            });
        }
    });
    let bestId = GUILD_IDS[0];
    let bestScore = scores[bestId];
    GUILD_IDS.forEach((gid) => {
        if (scores[gid] > bestScore) {
            bestScore = scores[gid];
            bestId = gid;
        }
    });
    return bestId;
}
