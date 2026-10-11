// The Torn Map · Junior B (8-9): four answers, three groups. Was / were, past simple, prepositions.
import { R, ADV } from './mapKit.mjs';

export const ADVENTURES = [
    ADV('jb-castle', 'The Castle of Echoes', 'Long ago, a princess hid a golden bell in the Castle of Echoes. Can your class find it?', 'Ding, dong! The golden bell rang across the land. The castle wasn’t silent any more!', [
        R('jb-castle-1', 'The heroes arrived at the castle gate. A guard was there.', 'What did the guard have?', '🗡️ sword|🏹 bow|🔨 hammer|🛡️ shield', 3,
            [[0, 'It wasn’t sharp.'], [1, 'He didn’t shoot arrows with it.'], [2, 'He didn’t hit nails with it.']]),
        R('jb-castle-2', 'Inside, there was a long corridor with four doors.', 'Which door did they open?', '🔴 red door|🔵 blue door|🟢 green door|🟡 yellow door', 1,
            [[0, 'It wasn’t the colour of fire.'], [2, 'It wasn’t the colour of leaves.'], [3, 'It wasn’t the colour of a banana.']]),
        R('jb-castle-3', 'Behind the door, there was a room full of animal pictures.', 'Which animal was in the biggest picture?', '🦁 lion|🐺 wolf|🦌 deer|🦉 owl', 2,
            [[0, 'It didn’t have a big mane.'], [1, 'It didn’t howl at the moon.'], [3, 'It wasn’t a bird.']]),
        R('jb-castle-4', 'Under the deer picture, there was a message: “Go up!”', 'How did they go up?', '🪜 ladder|🛗 lift|🪢 rope|🎈 balloon', 0,
            [[1, 'There wasn’t any electricity in the castle.'], [2, 'It wasn’t made of string.'], [3, 'They didn’t float up.']]),
        R('jb-castle-5', 'At the top of the tower, it was very dark.', 'What did they light?', '🕯️ candle|🔥 campfire|💡 lamp|🔦 torch', 0,
            [[1, 'It wasn’t on the floor.'], [2, 'It wasn’t on the ceiling.'], [3, 'It didn’t need batteries.']]),
        R('jb-castle-6', 'They saw the bell, but it was in a locked box!', 'Where was the key?', '🛏️ under the bed|📚 on the bookshelf|🪞 behind the mirror|🧸 in the teddy', 2,
            [[0, 'It wasn’t under anything.'], [1, 'It wasn’t on anything.'], [3, 'It wasn’t inside anything.']])
    ]),
    ADV('jb-robot', 'The Runaway Robot', 'Bolt the robot ran away from the toy factory. Follow the clues and bring Bolt back!', 'Bolt was in the toy shop window, smiling at the children. Bolt didn’t want to be alone. Bolt wanted friends!', [
        R('jb-robot-1', 'Bolt left the factory at night.', 'What did Bolt take?', '🔋 battery|🔦 torch|🗺️ map|☂️ umbrella', 1,
            [[0, 'Bolt didn’t need more power.'], [2, 'Bolt knew the way.'], [3, 'It wasn’t raining.']]),
        R('jb-robot-2', 'Bolt’s footprints went across the park.', 'What was in the park?', '⛲ fountain|🎠 carousel|🪁 kite|🌳 big tree', 0,
            [[1, 'It didn’t go round and round.'], [2, 'It wasn’t in the sky.'], [3, 'It didn’t have any leaves.']]),
        R('jb-robot-3', 'Bolt was wet from the fountain! Bolt went into a warm shop.', 'Which shop was it?', '🥖 bakery|💐 flower shop|👕 clothes shop|📚 bookshop', 0,
            [[1, 'It didn’t smell of roses.'], [2, 'You couldn’t buy T-shirts there.'], [3, 'There weren’t any stories there.']]),
        R('jb-robot-4', 'The baker saw Bolt. “Hello, little robot!” She gave Bolt something.', 'What did she give Bolt?', '🥐 croissant|🍞 loaf of bread|🍩 doughnut|🧁 cupcake', 2,
            [[0, 'It wasn’t the shape of a moon.'], [1, 'It wasn’t long.'], [3, 'It didn’t have a paper cup.']]),
        R('jb-robot-5', 'Bolt walked to the river. There were four boats.', 'Which boat did Bolt take?', '⛵ sailing boat|🚤 speedboat|🛶 canoe|🚢 big ship', 2,
            [[0, 'It didn’t have a sail.'], [1, 'It wasn’t fast and noisy.'], [3, 'It wasn’t very, very big.']]),
        R('jb-robot-6', 'Bolt got off at the town square.', 'Where was Bolt in the end?', '🧸 toy shop|🏫 school|🏥 hospital|🚉 station', 0,
            [[1, 'There weren’t any desks there.'], [2, 'There weren’t any doctors there.'], [3, 'There weren’t any trains there.']])
    ]),
    ADV('jb-giant', 'The Giant’s Garden', 'A friendly giant had a beautiful garden. One morning, his favourite things were missing!', 'The giant smiled a giant smile. His garden was perfect again, and he invited everyone for tea!', [
        R('jb-giant-1', 'The giant was sad. “My watering can is gone!”', 'Who took it?', '🐰 rabbit|🐸 frog|🦔 hedgehog|🐿️ squirrel', 3,
            [[0, 'The thief didn’t have long ears.'], [1, 'The thief wasn’t green.'], [2, 'The thief didn’t have spikes.']]),
        R('jb-giant-2', 'The squirrel hid the can in a tree.', 'Which tree?', '🌲 pine tree|🌴 palm tree|🌳 oak tree|🌵 cactus', 2,
            [[0, 'It wasn’t a Christmas tree.'], [1, 'It wasn’t from a sunny beach.'], [3, 'It didn’t have spines.']]),
        R('jb-giant-3', 'Next, the giant’s flowers were missing.', 'Which flowers were missing?', '🌹 roses|🌻 sunflowers|🌷 tulips|💐 a bunch of flowers', 2,
            [[0, 'They weren’t red.'], [1, 'They weren’t tall and yellow.'], [3, 'They weren’t in a bunch.']]),
        R('jb-giant-4', 'A bird saw everything. “A goat ate them!”', 'Where was the goat?', '🌉 on the bridge|🌊 in the river|⛰️ on the hill|🏠 in the house', 2,
            [[0, 'It wasn’t over the water.'], [1, 'It wasn’t wet.'], [3, 'It wasn’t inside.']]),
        R('jb-giant-5', 'The goat said sorry. “I was hungry!” The giant gave it some food.', 'What did the goat eat?', '🌿 grass|🍕 pizza|🍫 chocolate|🥩 meat', 0,
            [[1, 'It wasn’t hot.'], [2, 'It wasn’t sweet.'], [3, 'It wasn’t from an animal.']]),
        R('jb-giant-6', 'Now the giant wanted to make tea for everyone.', 'What did he need?', '🫖 teapot|🍳 frying pan|🥣 bowl|🍴 fork', 0,
            [[1, 'It wasn’t for eggs.'], [2, 'It wasn’t for cereal.'], [3, 'It didn’t have any points.']])
    ]),
    ADV('jb-circus', 'The Starlight Circus', 'The circus came to town, but the star of the show was missing!', 'The show started. The crowd clapped and cheered. It was the best circus night ever!', [
        R('jb-circus-1', 'The ringmaster looked in the big tent.', 'Who was the missing star?', '🤹 juggler|🤡 clown|🐘 elephant|🦁 lion', 0,
            [[1, 'The star didn’t have a red nose.'], [2, 'The star didn’t have a trunk.'], [3, 'The star didn’t roar.']]),
        R('jb-circus-2', 'There was a note on the floor: “I went to buy something.”', 'What did the juggler buy?', '🎈 balloons|⚾ balls|🍦 ice cream|🎟️ tickets', 1,
            [[0, 'They weren’t full of air.'], [2, 'They weren’t cold.'], [3, 'They weren’t made of paper.']]),
        R('jb-circus-3', 'The juggler went to the toy shop, but it was closed!', 'What time was it?', '🕗 eight o’clock|🕛 twelve o’clock|🕒 three o’clock|🕕 six o’clock', 0,
            [[1, 'The hands weren’t together at the top.'], [2, 'The little hand wasn’t on the right.'], [3, 'The little hand wasn’t at the bottom.']]),
        R('jb-circus-4', 'The juggler took a bus back to the circus.', 'Which bus was it?', '2️⃣ number 2|5️⃣ number 5|8️⃣ number 8|🔟 number 10', 1,
            [[0, 'It wasn’t smaller than three.'], [2, 'It wasn’t four plus four.'], [3, 'It wasn’t five plus five.']]),
        R('jb-circus-5', 'The juggler ran into the tent.', 'What was the juggler wearing?', '🎩 top hat|👑 crown|🎀 bow|🕶️ sunglasses', 0,
            [[1, 'It wasn’t gold.'], [2, 'It wasn’t pink.'], [3, 'It wasn’t for the eyes.']]),
        R('jb-circus-6', 'The show began!', 'What did the juggler juggle first?', '🍎 apples|🥚 eggs|🔥 fire torches|🍽️ plates', 0,
            [[1, 'Chickens didn’t lay them.'], [2, 'They weren’t hot.'], [3, 'You didn’t put food on them.']])
    ]),
    ADV('jb-kite', 'The Sky Kite Race', 'Every spring, the town had a kite race. This year, your class wanted to win!', 'Your kite flew higher than the clouds! The whole town shouted, “The winner!”', [
        R('jb-kite-1', 'First, the class made a kite.', 'What shape was the kite?', '🔷 diamond|⭕ circle|⭐ star|❤️ heart', 0,
            [[1, 'It wasn’t round.'], [2, 'It didn’t have five points.'], [3, 'It wasn’t the shape of love.']]),
        R('jb-kite-2', 'They needed a long tail for the kite.', 'What did they use?', '🎀 ribbon|🧦 sock|🪢 rope|🍝 spaghetti', 0,
            [[1, 'It wasn’t for your feet.'], [2, 'It wasn’t thick and heavy.'], [3, 'You couldn’t eat it.']]),
        R('jb-kite-3', 'On race day, the weather was important.', 'What was the weather like?', '🌬️ windy|🌧️ rainy|❄️ snowy|🌫️ foggy', 0,
            [[1, 'There wasn’t any rain.'], [2, 'It wasn’t cold and white.'], [3, 'They could see very far.']]),
        R('jb-kite-4', 'There were four kites in the race.', 'Which kite was the class’s kite?', '🐉 dragon kite|🦋 butterfly kite|🐟 fish kite|🦅 eagle kite', 0,
            [[1, 'It wasn’t an insect.'], [2, 'It didn’t live in water.'], [3, 'It wasn’t a real bird.']]),
        R('jb-kite-5', 'Oh no! The string was stuck!', 'Where was it stuck?', '🌳 in a tree|🏠 on a roof|🚩 on a flagpole|🏮 on a lamp', 1,
            [[0, 'It wasn’t in the leaves.'], [2, 'It wasn’t next to a flag.'], [3, 'There wasn’t any light there.']]),
        R('jb-kite-6', 'A helper climbed up and got the string.', 'Who helped?', '🧑‍🚒 firefighter|🧑‍🍳 cook|🧑‍✈️ pilot|🧑‍🎨 painter', 0,
            [[1, 'The helper didn’t work in a kitchen.'], [2, 'The helper didn’t fly planes.'], [3, 'The helper didn’t paint pictures.']])
    ])
];

export const RESERVE = [
    R('jb-r1', '', 'Where was the lost crown?', '🏰 castle|🌳 forest|🏖️ beach|⛰️ mountain', 1,
        [[2, 'It wasn’t near the sea.'], [3, 'It wasn’t very high.'], [0, 'There weren’t any walls or doors.']]),
    R('jb-r2', '', 'Which hero found the golden key?', '🧝 elf|🧚 fairy|🧜 mermaid|🧙 wizard', 0,
        [[1, 'This hero didn’t have wings.'], [2, 'This hero didn’t live in the sea.'], [3, 'This hero didn’t have a long beard.']]),
    R('jb-r3', '', 'What did the dragon have for breakfast?', '🥞 pancakes|🍕 pizza|🥚 eggs|🍦 ice cream', 2,
        [[3, 'It wasn’t cold.'], [1, 'It didn’t have cheese on it.'], [0, 'There wasn’t any honey on it.']]),
    R('jb-r4', '', 'Which room was the treasure in?', '🛏️ bedroom|🍳 kitchen|🛁 bathroom|📚 library', 3,
        [[0, 'You don’t sleep in this room.'], [1, 'You don’t cook in this room.'], [2, 'You don’t have a bath in this room.']]),
    R('jb-r5', '', 'Which animal carried the message?', '🦉 owl|🐎 horse|🐇 rabbit|🐌 snail', 0,
        [[3, 'It wasn’t slow.'], [2, 'It didn’t have long ears.'], [1, 'It wasn’t very big.']]),
    R('jb-r6', '', 'When was the spring festival?', '❄️ winter|🌸 spring|☀️ summer|🍂 autumn', 1,
        [[0, 'It wasn’t cold and snowy.'], [2, 'It wasn’t very hot.'], [3, 'The leaves weren’t falling.']]),
    R('jb-r7', '', 'Which instrument did the bard play?', '🎸 guitar|🥁 drum|🎺 trumpet|🎹 piano', 0,
        [[1, 'You don’t hit it with sticks.'], [2, 'You don’t blow into it.'], [3, 'It doesn’t have black and white keys.']]),
    R('jb-r8', '', 'Who was the knight’s new friend?', '🧑‍🍳 cook|🧑‍⚕️ doctor|🧑‍🌾 farmer|🧑‍🏫 teacher', 3,
        [[0, 'This person didn’t work in a kitchen.'], [1, 'This person didn’t help sick people.'], [2, 'This person didn’t work on a farm.']])
];
