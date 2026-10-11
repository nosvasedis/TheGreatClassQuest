// The Torn Map · League B (10-11): five answers, four groups. Past continuous, going to, and / but / because / so.
import { R, ADV } from './mapKit.mjs';

export const ADVENTURES = [
    ADV('b-desert', 'The Desert of Echoes', 'A caravan was crossing the Desert of Echoes when a sandstorm hid the road. Your class must guide it to the Oasis of Ten Palms.', 'As the sun was setting, the caravan reached the Oasis of Ten Palms. The camels drank, the travellers sang, and the desert echoed your class’s name.', [
        R('b-desert-1', 'The sandstorm was blowing hard, so the travellers looked for shelter.', 'Where did they shelter?', '🏜️ on top of a dune|⛺ in their tents|🪨 behind a huge rock|🐫 next to the camels|🌴 under a palm tree', 2,
            [[0, 'The wind was strongest on top of the dunes.'], [1, 'They couldn’t put up tents in that wind.'], [3, 'The camels were moving around, so it wasn’t safe.'], [4, 'There weren’t any trees nearby.']]),
        R('b-desert-2', 'When the storm stopped, they were going to continue, but the camels were tired.', 'What did the camels need?', '😴 a long rest|💧 water|🍎 apples|🧥 blankets|🎶 music', 0,
            [[1, 'They drank a lot at the last well, so they weren’t thirsty.'], [2, 'They ate in the morning, so they weren’t hungry.'], [3, 'It was hot, so they didn’t need blankets.'], [4, 'Music wasn’t going to help tired legs.']]),
        R('b-desert-3', 'While the camels were resting, a traveller was looking at the night sky.', 'Which light did she follow?', '⭐ the brightest light|✨ the twinkling star|🌌 the group of seven stars|🌠 the shooting star|🔴 the red star', 4,
            [[0, 'The brightest light was a planet, so it wasn’t a star at all.'], [1, 'The twinkling star was behind a cloud.'], [2, 'A group isn’t one star.'], [3, 'A shooting star disappears in a second.']]),
        R('b-desert-4', 'They were walking towards the red star when they saw lights in the distance.', 'What were the lights?', '🏮 market lanterns|🔥 a campfire|🚗 car lights|🐺 wolves’ eyes|✨ fireflies', 0,
            [[1, 'There were dozens of lights, but a campfire is just one.'], [2, 'There weren’t any roads, so they weren’t cars.'], [3, 'The lights were colourful, but eyes don’t shine in colours.'], [4, 'Fireflies need water and plants, so they don’t live in the deep desert.']]),
        R('b-desert-5', 'It was a night market! A merchant was going to sell them a map.', 'What did the merchant want for it?', '💰 gold coins|🐫 a camel|📖 a story|🧂 salt|💎 a ruby', 2,
            [[0, 'He already had lots of gold, so he didn’t want more.'], [1, 'He was scared of camels.'], [3, 'He sold salt, so he didn’t need any.'], [4, 'He said jewels were boring.']]),
        R('b-desert-6', 'The map showed four wells and the oasis.', 'How far away was the oasis?', '🕐 one hour|🕑 two hours|🕒 three hours|🕓 four hours|🕔 five hours', 2,
            [[0, 'It wasn’t as close as the first well, and that was one hour away.'], [1, 'Two hours away there was only the second well.'], [3, 'The fourth well was four hours away, and the oasis wasn’t there.'], [4, 'Sunset was in four and a half hours, and they arrived before it.']])
    ]),
    ADV('b-cloud', 'The Cloud Citadel', 'Above the clouds floated a citadel where the Wind Keepers lived. Their weather vane was spinning wildly, so the seasons were getting mixed up!', 'The weather vane pointed north again. Spring returned to the valleys, and the Wind Keepers named your class “Friends of the Sky”.', [
        R('b-cloud-1', 'To reach the citadel, the class was going to need transport.', 'How did they go up?', '🎈 hot-air balloon|🚁 helicopter|🪜 a very long ladder|🦅 giant eagles|🚀 rocket', 0,
            [[1, 'There wasn’t a place for a helicopter to land.'], [2, 'No ladder was long enough.'], [3, 'The giant eagles were sleeping.'], [4, 'A rocket was going to fly past the citadel and into space.']]),
        R('b-cloud-2', 'While they were floating up, they met a Wind Keeper.', 'What was the Wind Keeper holding?', '🪁 a kite|☂️ an umbrella|🎐 a wind chime|🪶 a feather|🧭 a compass', 2,
            [[0, 'It wasn’t flying on a string.'], [1, 'It was sunny, so she didn’t need an umbrella.'], [3, 'It was making music, but a feather is silent.'], [4, 'It didn’t have a needle that pointed north.']]),
        R('b-cloud-3', 'The Wind Keeper said, “The weather vane broke because something hit it.”', 'What hit the weather vane?', '⚡ lightning|⚽ a ball|🦢 a swan|☄️ a comet|🧊 hail', 1,
            [[0, 'There wasn’t a storm that week, so it wasn’t lightning.'], [2, 'The swans were all swimming on the lake that morning.'], [3, 'The next comet was going to come next year, not this year!'], [4, 'It wasn’t cold enough for hail.']]),
        R('b-cloud-4', 'A ball! But who was playing football in the sky?', 'Who kicked the ball?', '🧒 a cloud child|🐉 a sky dragon|🧙 a wizard|🦄 a unicorn|🧚 a fairy', 0,
            [[1, 'The dragon was asleep because it was winter.'], [2, 'The wizard was reading in his tower all day.'], [3, 'The unicorn wasn’t playing because it had a sore leg.'], [4, 'Fairies are too small to kick a football.']]),
        R('b-cloud-5', 'The cloud child was sorry, so she was going to help fix the vane.', 'What did they need to fix it?', '🔧 a spanner|🧵 thread|🍯 honey|🩹 a plaster|🔩 a new bolt', 4,
            [[0, 'They had a spanner, but it wasn’t the missing part.'], [1, 'Thread wasn’t strong enough.'], [2, 'Honey was too sticky and messy.'], [3, 'A plaster is for people, not for metal.']]),
        R('b-cloud-6', 'Finally, the vane needed to point the right way.', 'Which way did it point?', '⬆️ north|⬇️ south|➡️ east|⬅️ west|🔄 round and round', 0,
            [[1, 'It wasn’t going to point at the southern sea.'], [2, 'It wasn’t the direction of the sunrise.'], [3, 'It wasn’t the direction of the sunset.'], [4, 'Spinning was the problem, so that wasn’t the answer!']])
    ]),
    ADV('b-ember', 'The Ember Coast', 'On the Ember Coast, a volcano was rumbling. The villagers were going to leave, but their treasure, the Fire Opal, was still in the old temple.', 'The class carried the Fire Opal to the village just before the volcano puffed a harmless cloud of smoke. The villagers threw a party on the beach!', [
        R('b-ember-1', 'The village chief was waiting at the harbour.', 'What was the chief wearing?', '👑 a crown|🎩 a top hat|🪖 a helmet|🧢 a cap|👒 a sun hat', 4,
            [[0, 'She wasn’t a queen.'], [1, 'It wasn’t tall and black.'], [2, 'She wasn’t a soldier.'], [3, 'It wasn’t a sports cap.']]),
        R('b-ember-2', 'To reach the temple, they were going to cross the bay.', 'How did they cross?', '🚤 speedboat|🛶 canoe|⛵ sailing boat|🏊 swimming|🌉 bridge', 1,
            [[0, 'There wasn’t any petrol.'], [2, 'There wasn’t any wind, so the sails were useless.'], [3, 'The water was too warm and too deep to swim in.'], [4, 'There wasn’t a bridge.']]),
        R('b-ember-3', 'While they were paddling, they saw some animals in the water.', 'What did they see?', '🐢 turtles|🐬 dolphins|🦀 crabs|🐙 an octopus|🐟 small fish', 1,
            [[0, 'The animals weren’t slow.'], [2, 'They weren’t walking on the sea floor.'], [3, 'There were lots of them, not just one.'], [4, 'They were jumping out of the water and whistling.']]),
        R('b-ember-4', 'At the temple, there were five doors with signs.', 'Which door was safe?', '🔥 Fire|💧 Water|🌬️ Wind|🪨 Stone|🌳 Wood', 1,
            [[0, 'Flames were coming from behind the Fire door, so they didn’t open it.'], [2, 'The Wind door was locked because of the storm.'], [3, 'The Stone door was too heavy to open.'], [4, 'The Wood door was burning, so it was dangerous.']]),
        R('b-ember-5', 'Inside, the Fire Opal was on a high shelf.', 'How did they reach it?', '🪜 with a ladder|🧗 by climbing the wall|🦘 by jumping|🤸 standing on each other’s shoulders|🦒 by asking a giraffe', 3,
            [[0, 'The ladder was broken.'], [1, 'The walls were too smooth to climb.'], [2, 'It was too high to jump.'], [4, 'There weren’t any giraffes on the Ember Coast!']]),
        R('b-ember-6', 'The volcano was getting louder. They were running back when the path split.', 'Which path did they take?', '⬅️ the left path|➡️ the right path|⬆️ the middle path|🌉 the bridge path|🕳️ the tunnel', 1,
            [[0, 'The left path was covered in hot lava.'], [2, 'The middle path was blocked by rocks.'], [3, 'The bridge was shaking, so it wasn’t safe.'], [4, 'The tunnel was full of smoke.']])
    ]),
    ADV('b-north', 'The Frozen North', 'In the Frozen North, the Northern Lights had disappeared. The people of Snowhaven asked your class to bring the colours back.', 'Green, purple and gold danced across the sky. The Northern Lights were back, and Snowhaven celebrated all night long.', [
        R('b-north-1', 'The class arrived at Snowhaven on a sledge.', 'What was pulling the sledge?', '🐕 huskies|🐎 horses|🦌 reindeer|🐻‍❄️ polar bears|🐧 penguins', 0,
            [[1, 'Horses couldn’t walk well in the deep snow.'], [2, 'The animals didn’t have antlers.'], [3, 'Polar bears are too dangerous, so nobody uses them.'], [4, 'Penguins live at the South Pole, not the North!']]),
        R('b-north-2', 'An old woman was knitting by the fire. She knew the story.', 'Who took the Northern Lights?', '🐉 an ice dragon|👸 the Snow Queen|👻 a ghost|🦉 a snowy owl|🐺 a white wolf', 0,
            [[1, 'The Snow Queen was on holiday because it was summer in her land.'], [2, 'Ghosts aren’t real, so it wasn’t a ghost.'], [3, 'Owls can’t carry something so big.'], [4, 'The wolves were sleeping in their caves.']]),
        R('b-north-3', 'The ice dragon lived on a mountain. Before the climb, they packed their bags.', 'What did they take?', '🧗 a climbing rope|🏄 a surfboard|⛱️ a beach umbrella|🩴 flip-flops|🎣 a fishing rod', 0,
            [[1, 'There weren’t any waves.'], [2, 'It wasn’t sunny.'], [3, 'Their feet were going to freeze.'], [4, 'They weren’t going fishing.']]),
        R('b-north-4', 'While they were climbing, they heard crying.', 'Who was crying?', '🐲 a baby dragon|👶 a baby|🐱 a kitten|🐺 a wolf cub|🧒 a lost child', 0,
            [[1, 'Babies don’t climb mountains!'], [2, 'It wasn’t meowing.'], [3, 'It wasn’t howling.'], [4, 'It wasn’t speaking English or Greek.']]),
        R('b-north-5', 'The baby dragon was lost, so the class took it home to its mum, the ice dragon.', 'How did the ice dragon feel?', '😡 angry|😢 sad|😊 grateful|😴 sleepy|😱 scared', 2,
            [[0, 'It wasn’t angry because its baby was safe.'], [1, 'It stopped crying when it saw the baby.'], [3, 'Its eyes were wide open.'], [4, 'Dragons aren’t scared of children!']]),
        R('b-north-6', '“The Northern Lights are in my treasure room,” said the dragon. “Take them back.”', 'Where were the Lights?', '📦 in a box|🏺 in a vase|🧳 in a suitcase|🔮 in a crystal ball|🎁 in a present', 3,
            [[0, 'The box was empty.'], [1, 'The vase was too small.'], [2, 'The suitcase was full of clothes.'], [4, 'The present was for the baby dragon’s birthday.']])
    ]),
    ADV('b-lantern', 'The Lantern Festival', 'Every year, the town of Lumen held a Lantern Festival. This year, your class was going to light the Great Lantern, but someone had hidden the matches!', 'The Great Lantern rose into the night sky and thousands of small lanterns followed it. Everyone in Lumen cheered for your class.', [
        R('b-lantern-1', 'The festival organiser was looking worried.', 'Who was the organiser?', '🧑‍🍳 a chef|🧑‍🏫 the head teacher|👮 a police officer|🧑‍🔬 a scientist|🧑‍🎤 a singer', 1,
            [[0, 'The organiser wasn’t cooking the festival food.'], [2, 'The organiser wasn’t wearing a uniform.'], [3, 'The organiser didn’t work in a laboratory.'], [4, 'The organiser couldn’t sing at all.']]),
        R('b-lantern-2', 'She said, “I was putting up decorations when the matches disappeared.”', 'Where were the decorations?', '🌳 in the trees|🏠 on the houses|🌉 on the bridge|⛲ around the fountain|🏫 at the school', 2,
            [[0, 'It was windy, so they weren’t in the trees.'], [1, 'People didn’t want decorations on their homes.'], [3, 'The fountain was broken.'], [4, 'The school was closed for the holiday.']]),
        R('b-lantern-3', 'On the bridge, they found some small footprints.', 'Whose were they?', '🐈 a cat|🐦 a bird|🐿️ a squirrel|🦝 a raccoon|🐕 a dog', 3,
            [[0, 'The cat was asleep at home.'], [1, 'The prints weren’t from an animal with two legs.'], [2, 'The prints were bigger than a squirrel’s.'], [4, 'The dog was helping the police at the time.']]),
        R('b-lantern-4', 'The raccoon was hiding somewhere in the park.', 'Where was it?', '🌳 up a tree|🗑️ in a bin|🕳️ in a hole|🪑 under a bench|🏚️ in a shed', 1,
            [[0, 'There wasn’t a raccoon in the trees.'], [2, 'The holes were too small.'], [3, 'Children were sitting on the benches, so it wasn’t there.'], [4, 'The shed was locked.']]),
        R('b-lantern-5', 'The raccoon was going to give back the matches, but only for a snack.', 'Which snack did it choose?', '🍕 pizza|🍎 an apple|🍪 a biscuit|🥦 broccoli|🌽 corn', 4,
            [[0, 'The pizza was too hot.'], [1, 'The apples were sour.'], [2, 'It ate biscuits yesterday, so it wanted something different.'], [3, 'Nobody likes broccoli, not even raccoons!']]),
        R('b-lantern-6', 'Now it was time to light the Great Lantern.', 'What did they need to do first?', '🔥 light the candle inside|🎈 let it fill with hot air|✂️ cut the strings|🎉 start the music|📸 take a photo', 0,
            [[1, 'You need fire before you get hot air.'], [2, 'If they cut the strings first, it was going to fly away empty.'], [3, 'The music was going to start when the lantern went up.'], [4, 'The photo was going to come at the end.']])
    ])
];

export const RESERVE = [
    R('b-r1', '', 'Which sport does the prince love?', '⚽ football|🏊 swimming|🎾 tennis|🚴 cycling|⛷️ skiing', 2,
        [[4, 'You don’t need snow for it.'], [1, 'You don’t need a pool for it.'], [3, 'You don’t ride a bike.'], [0, 'You don’t kick a ball.']]),
    R('b-r2', '', 'What weather will the sailors meet?', '⛈️ storm|🌫️ fog|☀️ sunshine|❄️ snow|🌬️ wind', 1,
        [[0, 'There won’t be any thunder.'], [3, 'There won’t be any snow.'], [2, 'It won’t be hot and bright.'], [4, 'It won’t be windy.']]),
    R('b-r3', '', 'What is inside the magic chest?', '💎 diamond|📜 scroll|🗝️ key|💰 coins|👑 crown', 1,
        [[2, 'You can’t open a door with it.'], [4, 'You can’t wear it on your head.'], [3, 'It isn’t money.'], [0, 'It isn’t a jewel.']]),
    R('b-r4', '', 'Which place did the travellers visit first?', '🏜️ desert|🌋 volcano|🏝️ island|🏔️ mountain|🏙️ city', 2,
        [[4, 'It wasn’t full of buildings.'], [3, 'There wasn’t any snow.'], [1, 'There wasn’t any fire or smoke.'], [0, 'It wasn’t a dry place with no water.']]),
    R('b-r5', '', 'What did the detective find in the garden?', '👣 footprints|🧤 a glove|🔑 a key|📱 a phone|🧢 a cap', 1,
        [[0, 'It was raining all night, so there weren’t any footprints.'], [2, 'It didn’t open anything.'], [3, 'It didn’t ring or light up.'], [4, 'It wasn’t for wearing on your head.']]),
    R('b-r6', '', 'Which film did the class watch?', '🦖 a dinosaur film|👻 a ghost film|🚀 a space film|🐠 an underwater film|🦸 a superhero film', 3,
        [[0, 'They watched a dinosaur film last week, so they wanted something new.'], [1, 'The younger children were scared of ghosts.'], [2, 'Nobody in it was wearing a space suit.'], [4, 'Nobody in it was flying.']])
];
