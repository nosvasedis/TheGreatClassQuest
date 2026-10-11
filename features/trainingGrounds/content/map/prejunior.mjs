// The Torn Map · Pre-Junior (5-7): three pictures, two groups, picture-first clues read aloud.
import { R, ADV } from './mapKit.mjs';

export const ADVENTURES = [
    ADV('pj-picnic', 'Teddy’s Picnic Meadow', 'Teddy is going on a picnic! Help Teddy on the way.', 'Hooray! Teddy has a happy picnic with all the friends!', [
        R('pj-picnic-1', 'Teddy is hungry.', 'What does Teddy eat?', '🍎 apple|🍌 banana|🍓 strawberry', 0,
            [[1, 'It is not yellow.', '💛 🚫'], [2, 'It is not little.', '🐜 🚫']]),
        R('pj-picnic-2', 'Teddy is thirsty.', 'What does Teddy drink?', '🥛 milk|🧃 juice|💧 water', 0,
            [[2, 'It is not blue.', '💙 🚫'], [1, 'It is not in a box.', '📦 🚫']]),
        R('pj-picnic-3', 'A friend comes to the picnic.', 'Who is it?', '🐶 dog|🐱 cat|🐰 rabbit', 2,
            [[0, 'It doesn’t say “Woof!”', '🔊 🚫'], [1, 'It doesn’t say “Meow!”', '🔊 🚫']]),
        R('pj-picnic-4', 'Teddy wants to play.', 'What does Teddy play with?', '⚽ ball|🪁 kite|🚗 car', 1,
            [[0, 'It is not round.', '⚪ 🚫'], [2, 'No wheels!', '🚗 🚫']]),
        R('pj-picnic-5', 'Oh no! It is raining!', 'What does Teddy need?', '☂️ umbrella|🕶️ sunglasses|🧤 gloves', 0,
            [[1, 'Not for the sun.', '☀️ 🚫'], [2, 'Not for the hands.', '✋ 🚫']]),
        R('pj-picnic-6', 'It is time to go home.', 'How does Teddy go home?', '🚌 bus|⛵ boat|✈️ plane', 0,
            [[1, 'Not on the water.', '🌊 🚫'], [2, 'Not in the sky.', '☁️ 🚫']])
    ]),
    ADV('pj-garden', 'The Rainbow Garden', 'The garden has lost its colours! Find them together.', 'The garden is full of colours again. Beautiful!', [
        R('pj-garden-1', 'A flower is sad.', 'What colour is the flower?', '🔴 red|🔵 blue|🟡 yellow', 0,
            [[2, 'Not the sun colour.', '☀️ 🚫'], [1, 'Not the sea colour.', '🌊 🚫']]),
        R('pj-garden-2', 'A little animal lives in the garden.', 'Who is it?', '🐞 ladybird|🐌 snail|🐝 bee', 1,
            [[0, 'No spots.', '⚫ 🚫'], [2, 'No stripes.', '🦓 🚫']]),
        R('pj-garden-3', 'Something is in the tree.', 'What is it?', '🐦 bird|🍎 apple|🐱 cat', 1,
            [[0, 'It can’t fly.', '🕊️ 🚫'], [2, 'It doesn’t say “Meow!”', '🔊 🚫']]),
        R('pj-garden-4', 'The sun is hot. The flowers are thirsty.', 'What do the flowers need?', '💧 water|🔥 fire|⛄ snowman', 0,
            [[1, 'Not hot.', '🔥 🚫'], [2, 'Not cold.', '❄️ 🚫']]),
        R('pj-garden-5', 'Look! A rainbow!', 'How many colours?', '1️⃣ one|3️⃣ three|7️⃣ seven', 2,
            [[0, 'Lots of colours. Not one!', '1️⃣ 🚫'], [1, 'More than three!', '3️⃣ 🚫']]),
        R('pj-garden-6', 'The garden is happy again.', 'Who says “Thank you”?', '🌻 sunflower|🐸 frog|🐛 caterpillar', 1,
            [[0, 'It is not a flower.', '🌸 🚫'], [2, 'It is not long.', '📏 🚫']])
    ]),
    ADV('pj-moon', 'Moon Mouse’s Trip', 'Little Mouse wants to go to the moon!', 'Mouse is on the moon! The moon is made of… cheese? Yum!', [
        R('pj-moon-1', 'Mouse needs a ride.', 'What goes to the moon?', '🚀 rocket|🚲 bike|🚂 train', 0,
            [[1, 'Not two wheels.', '2️⃣ 🚫'], [2, 'It doesn’t say “Choo choo!”', '🔊 🚫']]),
        R('pj-moon-2', 'Mouse packs a bag.', 'What does Mouse take?', '🧀 cheese|🍫 chocolate|🍕 pizza', 0,
            [[1, 'Not brown.', '🟤 🚫'], [2, 'Not round.', '⚪ 🚫']]),
        R('pj-moon-3', 'Up, up, up!', 'What can Mouse see?', '⭐ star|☁️ cloud|🐦 bird', 0,
            [[1, 'Not white.', '⚪ 🚫'], [2, 'No wings.', '🕊️ 🚫']]),
        R('pj-moon-4', 'A friend says “Hello!”', 'Who is it?', '👽 alien|🤖 robot|🐶 dog', 0,
            [[1, 'Not metal.', '🔩 🚫'], [2, 'It doesn’t say “Woof!”', '🔊 🚫']]),
        R('pj-moon-5', 'Mouse is on the moon. It is dark!', 'What does Mouse need?', '🔦 torch|☂️ umbrella|🎈 balloon', 0,
            [[1, 'No rain on the moon.', '🌧️ 🚫'], [2, 'Not for a party.', '🎉 🚫']]),
        R('pj-moon-6', 'Mouse is sleepy.', 'Where does Mouse sleep?', '🛏️ bed|🛁 bath|🪑 chair', 0,
            [[1, 'No water.', '💧 🚫'], [2, 'Not for sitting.', '🪑 🚫']])
    ]),
    ADV('pj-farm', 'The Farm Party', 'The farm animals are having a party!', 'What a party! Everybody dances on the farm!', [
        R('pj-farm-1', 'The party is in the barn.', 'Who opens the door?', '🐄 cow|🐷 pig|🐔 chicken', 1,
            [[0, 'It doesn’t say “Moo!”', '🔊 🚫'], [2, 'Four legs!', '4️⃣ ✅']]),
        R('pj-farm-2', 'The horse brings food.', 'What food?', '🥕 carrot|🍰 cake|🥚 egg', 0,
            [[1, 'Not sweet.', '🍬 🚫'], [2, 'Not from a chicken.', '🐔 🚫']]),
        R('pj-farm-3', 'Music time!', 'What does the duck play?', '🥁 drum|🎸 guitar|🎺 trumpet', 0,
            [[2, 'You don’t blow it.', '💨 🚫'], [1, 'No strings.', '🧵 🚫']]),
        R('pj-farm-4', 'The sheep is cold.', 'What does the sheep wear?', '🧣 scarf|🩳 shorts|🕶️ sunglasses', 0,
            [[1, 'Not for the legs.', '🦵 🚫'], [2, 'Not for the eyes.', '👀 🚫']]),
        R('pj-farm-5', 'Let’s dance!', 'Who dances on one leg?', '🦩 flamingo|🐘 elephant|🐸 frog', 0,
            [[1, 'It is not big.', '🐘 🚫'], [2, 'It is not green.', '🟢 🚫']]),
        R('pj-farm-6', 'It is night now.', 'Who is awake at night?', '🦉 owl|🐓 rooster|🐝 bee', 0,
            [[1, 'It doesn’t say “Cock-a-doodle-doo!”', '🔊 🚫'], [2, 'It is not little.', '🐜 🚫']])
    ]),
    ADV('pj-sea', 'Splash! The Big Blue Sea', 'Let’s go to the big blue sea!', 'Splash! You find the sea treasure: a shiny pearl!', [
        R('pj-sea-1', 'We go to the beach.', 'What do we take?', '🪣 bucket|🧤 gloves|🎒 schoolbag', 0,
            [[1, 'Not for cold days.', '❄️ 🚫'], [2, 'Not for school.', '🏫 🚫']]),
        R('pj-sea-2', 'Something is in the sand.', 'What is it?', '🐚 shell|🦀 crab|⭐ star', 0,
            [[1, 'It can’t walk.', '🚶 🚫'], [2, 'Not in the sky.', '☁️ 🚫']]),
        R('pj-sea-3', 'Who swims with us?', 'Who is it?', '🐬 dolphin|🦈 shark|🐟 fish', 0,
            [[1, 'Not scary!', '😱 🚫'], [2, 'It is big.', '🐜 🚫']]),
        R('pj-sea-4', 'Look! A boat!', 'Who is on the boat?', '🦜 parrot|🐱 cat|🐒 monkey', 0,
            [[1, 'It doesn’t say “Meow!”', '🔊 🚫'], [2, 'It doesn’t eat bananas.', '🍌 🚫']]),
        R('pj-sea-5', 'The water is deep.', 'What helps us see?', '🤿 mask|👓 glasses|🔭 telescope', 0,
            [[1, 'Not for reading.', '📖 🚫'], [2, 'Not for the stars.', '⭐ 🚫']]),
        R('pj-sea-6', 'A box under the water!', 'What is in the box?', '💍 ring|👑 crown|🦪 pearl', 2,
            [[0, 'Not for your finger.', '☝️ 🚫'], [1, 'Not for your head.', '👦 🚫']])
    ])
];

export const RESERVE = [
    R('pj-r1', '', 'Which pet is sleeping?', '🐶 dog|🐱 cat|🐟 fish', 1,
        [[0, 'It doesn’t say “Woof!”', '🔊 🚫'], [2, 'It has got legs.', '🦵 ✅']]),
    R('pj-r2', '', 'What is in the sky at night?', '☀️ sun|🌙 moon|🌈 rainbow', 1,
        [[0, 'Not hot.', '🔥 🚫'], [2, 'Not lots of colours.', '🎨 🚫']]),
    R('pj-r3', '', 'Which toy is in the box?', '🧸 teddy|⚽ ball|🚗 car', 0,
        [[1, 'Not round.', '⚪ 🚫'], [2, 'No wheels.', '🚗 🚫']]),
    R('pj-r4', '', 'What is for breakfast?', '🥛 milk|🍕 pizza|🍦 ice cream', 0,
        [[1, 'Not round.', '⚪ 🚫'], [2, 'Not sweet.', '🍬 🚫']]),
    R('pj-r5', '', 'Who lives in the tree?', '🐦 bird|🐟 fish|🐄 cow', 0,
        [[1, 'Not in the water.', '🌊 🚫'], [2, 'Not big.', '🐘 🚫']]),
    R('pj-r6', '', 'What do we wear on our feet?', '👟 shoes|🧢 cap|🧤 gloves', 0,
        [[1, 'Not on the head.', '👦 🚫'], [2, 'Not on the hands.', '✋ 🚫']])
];
