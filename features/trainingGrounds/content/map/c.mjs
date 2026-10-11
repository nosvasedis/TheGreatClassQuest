// The Torn Map · League C (11-12): five answers, four groups. Present perfect, first conditional, relative clauses.
import { R, ADV } from './mapKit.mjs';

export const ADVENTURES = [
    ADV('c-library', 'The Library of Lost Words', 'In an ancient library, words have started disappearing from the books. If the class doesn’t find the Word Thief, every story will be blank by midnight.', 'The Word Thief was a lonely bookworm who only wanted someone to read to it. The words have flown back to their pages, and the library has a new reading club.', [
        R('c-library-1', 'The librarian, who has worked here for fifty years, is waiting at the door.', 'Which section has lost the most words?', '📜 History|🔬 Science|🧚 Fairy Tales|🗺️ Geography|🎨 Art', 2,
            [[0, 'The History books have lost only a few dates.'], [1, 'Nobody has touched the Science shelves for months.'], [3, 'The atlases, which are on the top floor, are still full of words.'], [4, 'The Art books have lost pictures, not words.']]),
        R('c-library-2', 'In Fairy Tales, the class finds a trail of tiny bite marks.', 'Who has left the marks?', '🐭 a mouse|🐛 a bookworm|🕷️ a spider|🐜 an ant|🦗 a cricket', 1,
            [[0, 'The library cat has caught every mouse in the building.'], [2, 'Spiders, which catch insects in webs, don’t bite paper.'], [3, 'Ants always travel in groups, but this creature is alone.'], [4, 'Nobody has heard any chirping.']]),
        R('c-library-3', 'The trail leads to a room that nobody has opened for a century.', 'What opens the door?', '🗝️ a golden key|🔤 a password|🪄 a spell|✊ a knock|🧲 a magnet', 1,
            [[0, 'Someone has filled the keyhole with wax.'], [2, 'Magic has never worked inside the library.'], [3, 'The sign says: “If you knock, the door will lock even tighter.”'], [4, 'The lock is made of wood, so a magnet won’t help.']]),
        R('c-library-4', 'The password is a word that has disappeared from every book.', 'Which word is it?', '📖 once|🌙 night|❤️ friend|🏰 castle|🐉 dragon', 2,
            [[0, '“Once” is still in “Once upon a time”, so it hasn’t vanished.'], [1, 'The class has just read the word “night” on a poster.'], [3, 'The castle book on the table still has “castle” on every page.'], [4, 'The librarian, who loves dragons, has checked: “dragon” is still there.']]),
        R('c-library-5', 'Inside the room sits a bookworm that has grown as big as a sofa.', 'Why has it eaten the words?', '😋 it was hungry|😴 it was bored|😢 it was lonely|😡 it was angry|🎂 it was its birthday', 2,
            [[0, 'It has just had a huge lunch of old newspapers.'], [1, 'It has a game it plays every day, so it isn’t bored.'], [3, 'It smiles at the class, so it isn’t angry.'], [4, 'Its birthday was in spring.']]),
        R('c-library-6', 'The class wants to help the bookworm and save the words.', 'What will they do?', '📚 read to it every week|🔒 lock it in the room|🍕 give it pizza|🚪 send it away|🧹 sweep it outside', 0,
            [[1, 'If they lock it in, it will feel even lonelier.'], [2, 'Pizza won’t fix a lonely heart.'], [3, 'If they send it away, the words will never come back.'], [4, 'Nobody who has a kind heart would sweep a friend outside.']])
    ]),
    ADV('c-marsh', 'The Marsh of Mirrors', 'Deep in a misty marsh, every pool reflects a different world. A traveller who looked into the wrong pool has been trapped inside it.', 'The traveller has stepped out of the pool, blinking in the sunlight. “I’ve been in a world of upside-down trees!” The marsh gives the class its rarest flower as thanks.', [
        R('c-marsh-1', 'The marsh guide, who has lived here all her life, offers to help.', 'What will the class need first?', '🥾 waterproof boots|🩴 sandals|⛸️ ice skates|🎿 skis|👠 high heels', 0,
            [[1, 'If they wear sandals, their feet will get soaked.'], [2, 'The water hasn’t frozen, so skates are useless.'], [3, 'There hasn’t been any snow this year.'], [4, 'Nobody has ever crossed a marsh in high heels!']]),
        R('c-marsh-2', 'The guide warns, “Only one path has never flooded.”', 'Which path is it?', '🟢 the green path|🔵 the blue path|🟤 the brown path|⚪ the white path|🟣 the purple path', 2,
            [[0, 'The green path, which goes through the reeds, flooded last week.'], [1, 'The blue path has been under water since spring.'], [3, 'The white path is made of chalk, which turns to mud in the rain.'], [4, 'Frogs have taken over the purple path.']]),
        R('c-marsh-3', 'A heron that has watched the marsh all day helps them.', 'Which pool did the traveller look into?', '🌕 the round pool|⭐ the star-shaped pool|💧 the tear-shaped pool|🔷 the diamond pool|❤️ the heart-shaped pool', 1,
            [[0, 'The round pool has been dry all week.'], [2, 'The heron, which has watched the tear-shaped pool all day, hasn’t seen him there.'], [3, 'The diamond pool is too deep to reach.'], [4, 'Nobody has found footprints near the heart-shaped pool.']]),
        R('c-marsh-4', 'In the star pool, the class sees the traveller in a world of upside-down trees.', 'What will pull him out?', '🪢 a rope|🎣 a fishing rod|🙌 a chain of hands|🪜 a ladder|🎵 a song he knows', 4,
            [[0, 'The rope has already sunk into the pool.'], [1, 'If they use a hook, they might hurt him.'], [2, 'Anyone who touches the water falls asleep.'], [3, 'The ladder has been too short for every pool so far.']]),
        R('c-marsh-5', 'They have found his bag on the path. It might tell them which song he knows.', 'Which song is it?', '🎂 Happy Birthday|🌟 Twinkle, Twinkle|🚣 Row, Row, Row Your Boat|🕷️ Incy Wincy Spider|🐑 Baa, Baa, Black Sheep', 2,
            [[0, 'His diary says his birthday has already passed this year.'], [1, 'He has drawn the sun, not the stars, all over his notebook.'], [3, 'He has written “I hate spiders!” on the first page.'], [4, 'His diary says he has never been to a farm.']]),
        R('c-marsh-6', 'The traveller is free! But the mist is rising, and it will hide the path home.', 'How will they find the way back?', '🧭 a compass|🍞 breadcrumbs|🔦 a torch|⭐ the stars|🐸 the frogs’ song', 0,
            [[1, 'The ducks have eaten every breadcrumb.'], [2, 'A torch won’t shine through thick mist.'], [3, 'If the mist covers the sky, they won’t see any stars.'], [4, 'The frogs, which sing all night, are silent during the day.']])
    ]),
    ADV('c-train', 'The Midnight Train', 'The Midnight Train only stops once a year, at a station that isn’t on any map. The class has a ticket, but the conductor says one passenger is not who they seem.', 'The impostor was a fox who wanted to see the city lights. The conductor has let the fox stay, and the train has arrived at the City of Stars on time.', [
        R('c-train-1', 'The class has found the station hidden behind a waterfall.', 'Which platform does the train leave from?', '1️⃣ Platform 1|2️⃣ Platform 2|3️⃣ Platform 3|4️⃣ Platform 4|5️⃣ Platform 5', 4,
            [[0, 'Platform 1 has been closed since the storm.'], [1, 'The train that leaves from Platform 2 goes to the sea.'], [2, 'If you wait on Platform 3, you’ll wait forever: no trains stop there.'], [3, 'Platform 4, which is the shortest, is too small for this train.']]),
        R('c-train-2', 'On the train, there are five passengers. One of them is the impostor.', 'Who is the impostor?', '👵 the grandmother|🧑‍🍳 the chef|🧑‍🎨 the painter|👮 the guard|🧑‍🎤 the singer', 0,
            [[1, 'The chef has cooked for the conductor for ten years.'], [2, 'The painter, who has paint on her hands, has just finished a portrait of the class.'], [3, 'The guard has shown his badge to everyone.'], [4, 'The singer has sung three songs, all perfectly.']]),
        R('c-train-3', 'The “grandmother” has a long bushy tail under her shawl!', 'What animal could she be?', '🦊 a fox|🐿️ a squirrel|🐺 a wolf|🐈 a cat|🦝 a raccoon', 0,
            [[1, 'She is much bigger than a squirrel.'], [2, 'She hasn’t howled once, even at the moon.'], [3, 'Cats don’t have bushy tails like this.'], [4, 'She hasn’t got a black mask around her eyes.']]),
        R('c-train-4', 'The fox admits it. “I’ve never seen a city!” The conductor needs to decide.', 'What will the conductor do?', '🚪 throw her off|🎟️ give her a ticket|👮 call the police|🔒 lock her up|🙈 ignore her', 1,
            [[0, 'If he throws her off, she’ll be lost in the forest at night.'], [2, 'There aren’t any police on a train that isn’t on any map.'], [3, 'The conductor, who has a kind heart, would never lock anyone up.'], [4, 'He has never ignored a passenger.']]),
        R('c-train-5', 'Suddenly, the train has stopped in a tunnel and the lights have gone out!', 'What has happened?', '🐄 a cow on the tracks|🌳 a fallen tree|⛽ no fuel|❄️ snow on the tracks|🦇 bats in the engine', 2,
            [[0, 'Cows don’t wander into tunnels.'], [1, 'Trees don’t grow in tunnels.'], [3, 'It has never snowed inside a tunnel.'], [4, 'The engine is sealed, so bats can’t get in.']]),
        R('c-train-6', 'The fuel is gone! But this train is magic: it runs on something special.', 'What fuel will the class give it?', '⭐ starlight|😂 laughter|🍫 chocolate|💧 water|🪵 wood', 1,
            [[0, 'There’s no starlight in a tunnel.'], [2, 'The class has already eaten all the chocolate!'], [3, 'If water gets into the engine, it will break.'], [4, 'A train that runs on wood isn’t magic at all.']])
    ]),
    ADV('c-observatory', 'The Starlit Observatory', 'An old observatory on a hill has the only telescope that can see the Wandering Star. The astronomer who built it has disappeared, and the star returns tonight.', 'At midnight, the class has seen the Wandering Star through the great telescope, and the astronomer, safe at last, has named a new constellation after your class.', [
        R('c-observatory-1', 'The class has climbed the hill. The observatory door is open.', 'Where has the astronomer gone?', '🏔️ to the mountains|🏖️ to the beach|🏙️ to the city|🏝️ to an island|🌲 into the forest', 3,
            [[0, 'Her climbing boots are still by the door.'], [1, 'Her diary says she hates crowded beaches.'], [2, 'She has never liked noisy cities.'], [4, 'Her map of the forest is still on the wall.']]),
        R('c-observatory-2', 'Her boat ticket says “The Isle of Owls”. The class must get there before dark.', 'Which boat will they take?', '⛵ the sailing boat|🚤 the speedboat|🛶 the rowing boat|🚢 the ferry|🛳️ the cruise ship', 1,
            [[0, 'There hasn’t been any wind all day.'], [2, 'If they row, they won’t arrive until morning.'], [3, 'The ferry has already left.'], [4, 'The cruise ship doesn’t stop at small islands.']]),
        R('c-observatory-3', 'On the island, they find her tent, but she isn’t there.', 'Who has seen her?', '🦉 the old owl|🐇 a rabbit|🦀 a crab|🐍 a snake|🐦 a seagull', 0,
            [[1, 'The rabbits, which sleep all day, haven’t seen anything.'], [2, 'The crabs have been under the sand all day.'], [3, 'There aren’t any snakes on the island.'], [4, 'The seagulls have flown to the mainland.']]),
        R('c-observatory-4', 'The owl says, “She has fallen into a deep hole while she was looking at the sky.”', 'What will get her out?', '🪢 a rope|🎈 balloons|🪜 a ladder|🦒 a giraffe|⛏️ digging', 0,
            [[1, 'Balloons won’t lift a grown-up.'], [2, 'The ladder in the tent is too short.'], [3, 'There are no giraffes on the island!'], [4, 'If they dig, the sides will fall in.']]),
        R('c-observatory-5', 'She is safe, but her leg hurts. “We must get to the telescope by midnight!”', 'How will they carry her?', '🛏️ on a stretcher they make|🚲 on a bike|🐴 on a horse|🚗 by car|🧹 on a broomstick', 0,
            [[1, 'Bikes won’t work on the sand.'], [2, 'There aren’t any horses on the island.'], [3, 'No car has ever been on the island.'], [4, 'Nobody in the class has learned to fly a broomstick… yet!']]),
        R('c-observatory-6', 'At the telescope, they must point it at the right part of the sky.', 'Where is the Wandering Star tonight?', '🌙 next to the Moon|🐻 near the Great Bear|🏹 near the Archer|🦂 near the Scorpion|🦢 near the Swan', 4,
            [[0, 'The Moon hasn’t risen yet.'], [1, 'The Great Bear has moved behind the mountain.'], [2, 'The Archer, which only shines in summer, isn’t visible tonight.'], [3, 'The Scorpion is so low that the trees are hiding it.']])
    ]),
    ADV('c-masquerade', 'The Masked Ball at Thornfield Hall', 'Thornfield Hall is hosting a masked ball. Someone has swapped the Queen’s diamond necklace for a fake, and the guests will leave at midnight.', 'The jewel thief was the Queen’s own parrot, who loves shiny things! The real necklace is back, and the parrot has been given a mirror of its own.', [
        R('c-masquerade-1', 'The guests who have arrived are all wearing masks.', 'Which guest arrived last?', '🦁 the Lion|🦊 the Fox|🦋 the Butterfly|🐉 the Dragon|🦉 the Owl', 4,
            [[0, 'The Lion arrived before the Fox.'], [1, 'The Fox has been here since the music started, long before the Owl.'], [2, 'The Butterfly, who came early, has danced every dance.'], [3, 'The Dragon arrived just before the Owl.']]),
        R('c-masquerade-2', 'The Owl says, “I’ve only just arrived. Ask the parrot, which has watched everyone.”', 'Where is the parrot?', '🪟 on the window|💡 on the chandelier|🎹 on the piano|🍰 on the cake table|🪞 by the big mirror', 4,
            [[0, 'The windows have been closed all evening.'], [1, 'If it sits on the chandelier, the candles will burn its feathers.'], [2, 'The pianist, who hates birds, has chased it away.'], [3, 'The cake table has been empty since nine.']]),
        R('c-masquerade-3', 'The parrot is admiring itself in the mirror. Something is shining under its wing!', 'What is under its wing?', '💎 the necklace|🔑 a key|🪙 a coin|🥄 a spoon|💍 a ring', 0,
            [[1, 'It isn’t something that opens doors.'], [2, 'It isn’t round and flat.'], [3, 'It isn’t cutlery.'], [4, 'It’s too long to be a ring.']]),
        R('c-masquerade-4', 'Is this the real necklace or the fake?', 'How will the class check?', '🔍 with a magnifying glass|🦷 by biting it|💧 by putting it in water|🔥 by holding it over a flame|⚖️ by weighing it', 0,
            [[1, 'If you bite a diamond, you’ll break a tooth.'], [2, 'Water won’t show anything.'], [3, 'Fire might damage the gold.'], [4, 'The jeweller says the fake and the real one weigh the same.']]),
        R('c-masquerade-5', 'It is the real one! So where has the parrot hidden the fake?', 'Where is the fake necklace?', '🪴 in a plant pot|🎩 in a hat|🧦 in a sock|🎂 in the cake|🛏️ under a pillow', 0,
            [[1, 'The guests have been wearing their hats all night.'], [2, 'Parrots can’t open drawers, which is where the socks are.'], [3, 'The cake, which was eaten an hour ago, had nothing inside.'], [4, 'The bedrooms upstairs have been locked all evening.']]),
        R('c-masquerade-6', 'The Queen must decide what to do with her parrot.', 'What will she do?', '🪞 give it its own mirror|🔒 lock it in a cage|🌳 send it to the forest|🍽️ give it no dinner|🗣️ shout at it', 0,
            [[1, 'It has lived in a cage before, and it was miserable.'], [2, 'If she sends it away, she will miss it terribly.'], [3, 'Parrots that don’t eat become ill.'], [4, 'The Queen has never shouted in her life.']])
    ])
];

export const RESERVE = [
    R('c-r1', '', 'Who stole the Moon Pearl?', '🧑‍🍳 the cook|🧑‍🌾 the gardener|💂 the guard|🧙 the wizard|🧑‍🎤 the minstrel', 1,
        [[2, 'The thief wasn’t wearing a uniform that night.'], [3, 'Whoever did it can’t use magic.'], [0, 'The thief wasn’t in the kitchen, which was full of people baking.'], [4, 'The person who took it can’t play an instrument.']]),
    R('c-r2', '', 'Which route should the caravan take?', '🏜️ the desert road|⛰️ the mountain pass|🌊 the coast road|🌲 the forest path|🌉 the river bridge', 2,
        [[1, 'Since the camels are exhausted, they can’t climb anything steep.'], [4, 'The bridge was destroyed in last night’s storm.'], [3, 'Wolves have been seen among the trees.'], [0, 'They have run out of water, so a dry route would be too dangerous.']]),
    R('c-r3', '', 'Which creature has been raiding the orchard?', '🦊 fox|🦇 bat|🦌 deer|🐦 crow|🐗 boar', 2,
        [[3, 'The farmer has found no black feathers anywhere.'], [1, 'The raids happen in daylight, so it isn’t a creature that only flies at night.'], [4, 'The ground hasn’t been dug up at all.'], [0, 'It has eaten only fruit and leaves, which a meat-eater would ignore.']]),
    R('c-r4', '', 'Which gift should the envoy bring the queen?', '🌹 roses|🐎 a horse|🧁 cakes|💍 a ring|📚 books', 4,
        [[0, 'The queen is allergic to flowers.'], [1, 'She already owns more horses than she can ride.'], [2, 'She has stopped eating sweets on her doctor’s advice.'], [3, 'She has never worn jewellery.']]),
    R('c-r5', '', 'Which planet has the class chosen for its project?', '🔴 Mars|🪐 Saturn|🔵 Neptune|🟠 Jupiter|🟡 Venus', 2,
        [[0, 'Another class has already chosen Mars.'], [1, 'Saturn, which has rings, was last year’s topic.'], [3, 'Jupiter is too big to fit on their poster!'], [4, 'If they choose Venus, they’ll need yellow paint, and they’ve run out.']]),
    R('c-r6', '', 'Who has eaten the last piece of cake?', '🐶 the dog|👦 Tom|👧 Ella|👵 Grandma|🐱 the cat', 0,
        [[1, 'Tom has been at football practice all afternoon.'], [2, 'Ella, who hates chocolate, would never touch it.'], [3, 'Grandma has just come back from the shops.'], [4, 'The cat has been asleep on the roof.']])
];
