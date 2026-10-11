// The Torn Map · League A (9-10): five answers, four groups. Past simple, there was / were, comparatives.
import { R, ADV } from './mapKit.mjs';

export const ADVENTURES = [
    ADV('a-isles', 'The Whispering Isles', 'A storm pushed your ship to the Whispering Isles, where the trees whisper secrets. Find the way home!', 'The last whisper said, “Follow the brightest star.” Your ship sailed home safely, with a story nobody believed!', [
        R('a-isles-1', 'Your ship crashed on the first island. The crew needed somewhere to sleep.', 'Where did they sleep?', '⛺ in a tent|🕳️ in a cave|🌴 under a palm tree|⛵ on the ship|🛖 in a hut', 4,
            [[0, 'They didn’t bring any tents.'], [1, 'The cave was too dark and wet.'], [2, 'It was too windy to sleep outside.'], [3, 'The ship was broken and full of water.']]),
        R('a-isles-2', 'In the morning, they heard whispers in the trees.', 'Who was whispering?', '🦜 parrot|🐒 monkey|🐍 snake|🦇 bat|🧚 fairy', 0,
            [[1, 'It didn’t have hands.'], [2, 'It didn’t hiss.'], [3, 'It wasn’t sleeping upside down.'], [4, 'It wasn’t magic.']]),
        R('a-isles-3', 'The parrot said, “Go to the island with the tallest mountain.”', 'Which island had the tallest mountain?', '🟥 Red Island|🟦 Blue Island|🟩 Green Island|🟨 Yellow Island|🟪 Purple Island', 2,
            [[1, 'Blue Island was flatter than Red Island.'], [0, 'Red Island’s mountain was smaller than Green Island’s.'], [3, 'Yellow Island didn’t have any mountains.'], [4, 'Purple Island’s mountain was lower than Green Island’s.']]),
        R('a-isles-4', 'On Green Island, they found an old wooden sign with an arrow.', 'Which way did the arrow point?', '⬆️ north|⬇️ south|➡️ east|⬅️ west|↗️ north-east', 2,
            [[0, 'It didn’t point at the North Star.'], [1, 'It didn’t point back to the beach, and the beach was south.'], [3, 'It didn’t point at the sunset.'], [4, 'It didn’t point between two directions.']]),
        R('a-isles-5', 'They walked east and found a river. They needed to cross it.', 'How did they cross?', '🌉 on a bridge|🛶 in a canoe|🪨 on stepping stones|🌳 on a fallen tree|🐊 on a crocodile', 2,
            [[0, 'There wasn’t a bridge anywhere.'], [1, 'They didn’t have a boat.'], [3, 'The fallen tree was too slippery.'], [4, 'The crocodile was awake and hungry!']]),
        R('a-isles-6', 'On the other side, there was a hill above the sea. A ship was passing!', 'What did they use to call the ship?', '🔦 a torch|🔔 a bell|📯 a horn|🪞 a mirror|🔥 a big fire', 4,
            [[0, 'The torch batteries were dead.'], [1, 'The bell was broken.'], [2, 'The horn wasn’t loud enough.'], [3, 'There wasn’t any sun to shine on a mirror.']])
    ]),
    ADV('a-sunken', 'The Sunken Kingdom', 'Deep under the sea, there was a kingdom of merfolk. Someone stole their Sea Pearl, and the sea was getting darker.', 'The Sea Pearl shone again and the whole kingdom glowed blue and gold. The merfolk sang for three days!', [
        R('a-sunken-1', 'Your class dived into the water.', 'What helped them breathe?', '🤿 snorkel|🎈 balloon|🌿 magic seaweed|🥤 straw|🐚 shell', 2,
            [[0, 'The snorkel tube was too short for deep water.'], [1, 'It floated up to the top.'], [3, 'It was too thin and small.'], [4, 'It was full of sand.']]),
        R('a-sunken-2', 'At the palace gate, a guard stopped them.', 'Who was the guard?', '🦈 shark|🐙 octopus|🦀 crab|🐡 pufferfish|🐢 sea turtle', 1,
            [[0, 'It didn’t have sharp teeth.'], [2, 'It didn’t walk sideways.'], [3, 'It didn’t puff up when it was scared.'], [4, 'It wasn’t slow.']]),
        R('a-sunken-3', 'The queen said, “The thief swam away fast, towards the dark rocks.”', 'Who was the thief?', '🐬 dolphin|🦑 squid|🐟 small fish|🐳 whale|🦭 seal', 1,
            [[0, 'The thief wasn’t friendly and playful.'], [2, 'The thief was bigger than a small fish.'], [3, 'The thief was smaller than a bus.'], [4, 'The thief never went onto the beach.']]),
        R('a-sunken-4', 'The squid hid in one of five caves.', 'Which cave?', '1️⃣ Cave 1|2️⃣ Cave 2|3️⃣ Cave 3|4️⃣ Cave 4|5️⃣ Cave 5', 3,
            [[0, 'The number was bigger than one.'], [1, 'It wasn’t an even number smaller than four.'], [2, 'It wasn’t half of six.'], [4, 'It wasn’t the last cave.']]),
        R('a-sunken-5', 'Inside the cave, the squid was crying. “I took the pearl because…”', 'Why did the squid take it?', '🌑 it was afraid of the dark|💰 it wanted money|🎁 it was a present for its mum|🍽️ it was hungry|🎮 it was a game', 0,
            [[1, 'Squids don’t use money.'], [2, 'Its mum didn’t know anything about it.'], [3, 'It knew pearls weren’t food.'], [4, 'It wasn’t playing.']]),
        R('a-sunken-6', 'The class had an idea to help the squid.', 'What did they give the squid?', '🔦 a torch|🕯️ a candle|💡 a light bulb|🐠 a glowing fish friend|🔥 fire', 3,
            [[0, 'The torch didn’t work under water.'], [1, 'A candle couldn’t burn in the sea.'], [2, 'There wasn’t any electricity.'], [4, 'Fire went out in the water.']])
    ]),
    ADV('a-peaks', 'The Crystal Peaks', 'High in the Crystal Peaks lived a snow dragon who guarded the Ice Crown. To reach it, the class had to climb higher than ever.', 'The snow dragon bowed. “Only a team could reach the top.” It gave the class the Ice Crown, which sparkled like a thousand stars.', [
        R('a-peaks-1', 'At the bottom of the mountain, there was a shop.', 'What did they buy?', '🧥 warm coats|🩳 shorts|👙 swimsuits|🕶️ sunglasses|🩴 flip-flops', 0,
            [[1, 'Their legs needed to be warm.'], [2, 'They weren’t going swimming.'], [3, 'Sunglasses weren’t enough on the cold mountain.'], [4, 'Their toes needed to be warm and dry.']]),
        R('a-peaks-2', 'The path split into five paths.', 'Which path was the safest?', '🌉 the rope bridge|🧊 the frozen lake|🌲 the forest path|🪨 the rocky path|🌀 the windy cliff', 2,
            [[0, 'The rope bridge was very old and broken.'], [1, 'The ice on the lake was thinner than paper.'], [3, 'Rocks were falling on the rocky path.'], [4, 'The cliff was the windiest place on the mountain.']]),
        R('a-peaks-3', 'In the forest, they met an animal who knew the way.', 'Who was it?', '🐐 mountain goat|🐧 penguin|🐻‍❄️ polar bear|🦌 reindeer|🐺 wolf', 0,
            [[1, 'Penguins don’t live on mountains.'], [2, 'It wasn’t white and huge.'], [3, 'It didn’t have big antlers.'], [4, 'It didn’t eat meat.']]),
        R('a-peaks-4', 'The goat climbed faster than the class. It waited for them on a rock.', 'What did the goat want?', '🥕 a carrot|🍫 chocolate|🍖 meat|🧂 salt|🧃 juice', 3,
            [[0, 'It had lots of carrots at home.'], [1, 'Chocolate isn’t good for goats.'], [2, 'It didn’t eat meat.'], [4, 'It wasn’t thirsty.']]),
        R('a-peaks-5', 'Near the top, a snowstorm began. They hid quickly.', 'Where did they hide?', '🛖 in an old hut|🕳️ in a small cave|🌲 under a tree|🧊 behind a block of ice|⛺ in a tent', 1,
            [[0, 'The old hut didn’t have a roof.'], [2, 'The tree was smaller than a person.'], [3, 'The ice was too thin.'], [4, 'They didn’t carry a tent.']]),
        R('a-peaks-6', 'At the top, the snow dragon asked, “What present did you bring me?”', 'What did the dragon want?', '🧣 a scarf|🍲 hot soup|🎶 a song|💎 a diamond|🔥 a fire', 2,
            [[0, 'Dragons don’t wear clothes.'], [1, 'It didn’t like hot food.'], [3, 'It already had more jewels than a king.'], [4, 'Fire was going to melt its home.']])
    ]),
    ADV('a-clock', 'The Clockwork City', 'In the Clockwork City, everything ran on gears. One day, the Great Clock stopped and the whole city froze!', 'Tick, tock! The Great Clock started again. The city came back to life, and the mayor gave your class golden gears.', [
        R('a-clock-1', 'The streets were silent. The class found the mayor frozen in his house.', 'What was the mayor doing when the clock stopped?', '🍽️ eating breakfast|📖 reading|🚿 having a shower|😴 sleeping|🏃 running', 1,
            [[0, 'There wasn’t any food on his table.'], [2, 'His hair wasn’t wet.'], [3, 'His eyes were open.'], [4, 'He was sitting in a chair.']]),
        R('a-clock-2', 'The mayor’s map showed the clockmaker’s home.', 'Where did the clockmaker live?', '🏰 in a tower|🏠 in a cottage|🏭 in a factory|⛪ in a church|🏢 in a block of flats', 0,
            [[1, 'Her home was taller than a cottage.'], [2, 'She didn’t live where things were made.'], [3, 'Her home didn’t have coloured glass windows.'], [4, 'She didn’t live in a building with other families.']]),
        R('a-clock-3', 'The clockmaker was ill in bed. “Please bring my tools!”', 'Which tool did she need first?', '🔧 spanner|🔨 hammer|✂️ scissors|🪛 screwdriver|🪚 saw', 3,
            [[0, 'It wasn’t for nuts and bolts.'], [1, 'She didn’t want to hit anything.'], [2, 'She didn’t need to cut paper.'], [4, 'She didn’t need to cut wood.']]),
        R('a-clock-4', 'The class climbed inside the Great Clock. A gear was missing.', 'Which gear fitted?', '🟤 the biggest gear|⚪ the smallest gear|🟠 the gear with 10 teeth|🔵 the gear with 12 teeth|🟢 the gear with 16 teeth', 3,
            [[0, 'It wasn’t bigger than all the others.'], [1, 'It wasn’t smaller than all the others.'], [2, 'It had more than ten teeth.'], [4, 'It had fewer than sixteen teeth.']]),
        R('a-clock-5', 'The gear was in, but the clock needed oil.', 'Where was the oil?', '🧴 in a bottle|📦 in a box|🛢️ in a barrel|🧺 in a basket|🥫 in a tin', 0,
            [[1, 'It wasn’t in anything made of cardboard.'], [2, 'It wasn’t in anything enormous.'], [3, 'It wasn’t in anything with holes in it.'], [4, 'It wasn’t in anything with soup on the label.']]),
        R('a-clock-6', 'The class moved the big hands to the right time.', 'What time did they set?', '🕐 one o’clock|🕒 three o’clock|🕕 six o’clock|🕘 nine o’clock|🕛 twelve o’clock', 1,
            [[0, 'The little hand wasn’t next to the twelve.'], [2, 'The hands weren’t in a straight line.'], [3, 'The little hand wasn’t on the left.'], [4, 'The hands weren’t on top of each other.']])
    ]),
    ADV('a-wilds', 'The Emerald Wilds', 'The Emerald Wilds was a jungle full of mysteries. The class wanted to find the Lost Temple of the Jaguar.', 'Behind the waterfall stood the Lost Temple. Inside, a golden jaguar statue smiled. The class were the first explorers there in a hundred years!', [
        R('a-wilds-1', 'The jungle was hot and noisy.', 'What was the most useful thing to carry?', '🧥 a heavy coat|💧 water bottles|🎿 skis|📺 a TV|🧸 a teddy', 1,
            [[0, 'It was too hot for heavy clothes.'], [2, 'There wasn’t any snow.'], [3, 'There wasn’t any electricity.'], [4, 'Toys weren’t important on this trip.']]),
        R('a-wilds-2', 'A river was in the way. Something was in the water!', 'What was in the river?', '🐊 crocodile|🦈 shark|🐋 whale|🐧 penguin|🦭 seal', 0,
            [[1, 'Sharks live in the sea, not in rivers.'], [2, 'It was smaller than a whale.'], [3, 'It didn’t have a black and white body.'], [4, 'It didn’t clap its flippers.']]),
        R('a-wilds-3', 'They found an old stone with a picture on it.', 'Which animal was on the stone?', '🐆 jaguar|🐒 monkey|🦜 parrot|🐍 snake|🐸 frog', 0,
            [[1, 'It didn’t eat bananas.'], [2, 'It didn’t have feathers.'], [3, 'It had legs.'], [4, 'It was bigger than a person’s hand.']]),
        R('a-wilds-4', 'The jaguar on the stone looked at a hill. “Walk towards the jaguar’s eyes.”', 'Which hill was it?', '🏔️ the snowy mountain|🌋 the volcano|⛰️ the rocky mountain|🗻 the tallest mountain|🏞️ the green hill', 4,
            [[0, 'It wasn’t cold at the top.'], [1, 'There wasn’t any smoke.'], [2, 'It wasn’t grey and rocky.'], [3, 'It wasn’t the tallest in the land.']]),
        R('a-wilds-5', 'They heard a waterfall! But something was across the path.', 'What blocked the path?', '🪨 a big rock|🌳 a fallen tree|🐘 an elephant|🕸️ a giant web|🐝 bees', 3,
            [[0, 'It wasn’t grey and hard.'], [1, 'It didn’t have leaves or branches.'], [2, 'It wasn’t an animal bigger than a car.'], [4, 'It didn’t buzz.']]),
        R('a-wilds-6', 'Behind the waterfall, a door had a riddle: “I am faster than a horse, quieter than a mouse, and I sleep in the trees.”', 'What was the answer?', '🐆 jaguar|🐎 horse|🐭 mouse|🦉 owl|🐒 monkey', 0,
            [[1, 'The answer was faster than a horse.'], [2, 'The answer was bigger than a mouse.'], [3, 'The answer didn’t fly.'], [4, 'The answer wasn’t noisy.']])
    ])
];

export const RESERVE = [
    R('a-r1', '', 'Where did the thief hide the golden goblet?', '🏰 castle|⛵ ship|🌉 bridge|🕳️ cave|🌲 forest', 3,
        [[1, 'It doesn’t move.'], [2, 'You don’t cross a river on it.'], [0, 'There are no stairs inside.'], [4, 'There aren’t any trees there.']]),
    R('a-r2', '', 'Which creature guards the gate?', '🦁 lion|🐍 snake|🦅 eagle|🐻 bear|🐺 wolf', 4,
        [[1, 'It has got legs.'], [2, 'It doesn’t fly.'], [3, 'It doesn’t sleep all winter.'], [0, 'It hasn’t got a big mane.']]),
    R('a-r3', '', 'What did the explorer forget at home?', '🧭 compass|🔦 torch|🗺️ map|☂️ umbrella|🎒 rucksack', 1,
        [[3, 'It doesn’t keep you dry.'], [0, 'It doesn’t show you which way is north.'], [4, 'You can’t carry things inside it.'], [2, 'It hasn’t got roads and rivers drawn on it.']]),
    R('a-r4', '', 'Who wrote the secret letter?', '🧑‍🚀 astronaut|🧑‍🍳 chef|🧑‍🎨 painter|🧑‍🚒 firefighter|🧑‍🔬 scientist', 2,
        [[0, 'The writer has never been to space.'], [3, 'The writer doesn’t put out fires.'], [4, 'The writer doesn’t work in a laboratory.'], [1, 'The writer doesn’t cook in a restaurant.']]),
    R('a-r5', '', 'Which planet did the astronaut visit?', '🔴 Mars|🪐 Saturn|🌍 Earth|☀️ the Sun|🌙 the Moon', 0,
        [[1, 'It didn’t have rings.'], [2, 'It wasn’t our home.'], [3, 'It wasn’t hotter than fire.'], [4, 'It wasn’t the place where people first walked in 1969.']]),
    R('a-r6', '', 'Which pet did Sam choose?', '🐶 puppy|🐱 kitten|🐹 hamster|🐠 goldfish|🐦 budgie', 2,
        [[0, 'Sam’s flat was too small for a pet that needs long walks.'], [1, 'Sam’s sister was allergic to cats.'], [3, 'Sam wanted a pet he could hold.'], [4, 'The pet couldn’t fly.']])
];
