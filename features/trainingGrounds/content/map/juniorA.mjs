// The Torn Map · Junior A (7-8): four answers, three groups. Present simple, has got, can, colours.
import { R, ADV } from './mapKit.mjs';

export const ADVENTURES = [
    ADV('ja-puppy', 'The Lost Puppy', 'Pip the puppy is lost in the town. Help Pip find home!', 'Pip is home! Pip’s family is very happy. Woof, woof!', [
        R('ja-puppy-1', 'Pip is near the park.', 'Who sees Pip first?', '🧑‍🏫 teacher|👮 police officer|🧑‍🍳 cook|🧑‍⚕️ doctor', 1,
            [[0, 'This person isn’t at school today.'], [2, 'This person doesn’t cook food.'], [3, 'This person doesn’t help sick people.']]),
        R('ja-puppy-2', 'The police officer has got some food for Pip.', 'What does Pip eat?', '🍖 meat|🥕 carrot|🍌 banana|🍦 ice cream', 0,
            [[1, 'It isn’t orange.'], [2, 'It isn’t yellow.'], [3, 'It isn’t cold.']]),
        R('ja-puppy-3', 'Pip runs into a big building.', 'Where is Pip?', '🏫 school|🏥 hospital|🏪 shop|🏰 castle', 2,
            [[0, 'Children don’t learn here.'], [1, 'Doctors don’t work here.'], [3, 'A king doesn’t live here.']]),
        R('ja-puppy-4', 'In the shop, Pip sees a friend.', 'Who is Pip’s friend?', '🐱 cat|🐭 mouse|🐦 bird|🐰 rabbit', 1,
            [[0, 'It doesn’t say “Meow!”'], [2, 'It can’t fly.'], [3, 'It hasn’t got long ears.']]),
        R('ja-puppy-5', 'Pip is tired.', 'Where does Pip sit?', '🪑 chair|🛋️ sofa|🛏️ bed|🛁 bath', 1,
            [[0, 'It isn’t hard.'], [2, 'You don’t sleep in it.'], [3, 'It hasn’t got water in it.']]),
        R('ja-puppy-6', 'Pip can see the family’s home!', 'Which home is it?', '🏠 house|🏰 castle|⛺ tent|🏢 tall building', 0,
            [[1, 'A king doesn’t live there.'], [2, 'It isn’t in a campsite.'], [3, 'It isn’t very tall.']])
    ]),
    ADV('ja-hat', 'The Wizard’s Lost Hat', 'Wizard Wally has lost his magic hat. Find it before the moon comes up!', 'Wally has got his hat! He waves his wand and the sky is full of stars.', [
        R('ja-hat-1', 'Wally looks in his tower.', 'Who helps Wally?', '🦉 owl|🐸 frog|🐈‍⬛ black cat|🐉 dragon', 0,
            [[1, 'It isn’t green.'], [2, 'It doesn’t say “Meow!”'], [3, 'It isn’t big.']]),
        R('ja-hat-2', 'The owl says, “The hat is in the garden!”', 'What is next to the hat?', '🌸 flower|🍄 mushroom|🌳 tree|🪨 rock', 1,
            [[0, 'It isn’t pink.'], [2, 'It isn’t tall.'], [3, 'It isn’t grey.']]),
        R('ja-hat-3', 'Whoosh! The wind takes the hat!', 'Where is the hat now?', '☁️ sky|🌊 sea|🏔️ mountain|🏠 house', 2,
            [[0, 'It isn’t up in the sky now.'], [1, 'It isn’t wet.'], [3, 'It isn’t in a house.']]),
        R('ja-hat-4', 'Wally climbs the mountain. He is hungry.', 'What does Wally eat?', '🍎 apple|🍫 chocolate|🍦 ice cream|🍕 pizza', 0,
            [[1, 'It isn’t brown.'], [2, 'It isn’t very cold.'], [3, 'It isn’t hot.']]),
        R('ja-hat-5', 'At the top, the hat is in a nest!', 'Whose nest is it?', '🦅 eagle|🐦 little bird|🦆 duck|🐧 penguin', 0,
            [[1, 'It isn’t little.'], [2, 'It doesn’t say “Quack!”'], [3, 'It can fly.']]),
        R('ja-hat-6', 'The eagle is friendly. “Here is your hat!”', 'What colour is the magic hat?', '🟣 purple|🔴 red|🟢 green|🟡 yellow', 0,
            [[1, 'It isn’t the colour of a strawberry.'], [2, 'It isn’t the colour of grass.'], [3, 'It isn’t the colour of the sun.']])
    ]),
    ADV('ja-robo', 'Robo’s Birthday', 'It’s Robo the robot’s birthday! Get everything ready for the party.', 'Happy birthday, Robo! Robo blows out the candles and beeps a happy song.', [
        R('ja-robo-1', 'First, a present for Robo.', 'What is the present?', '🪁 kite|🧸 teddy|🎨 paints|⚽ ball', 2,
            [[0, 'You can’t fly it.'], [1, 'It isn’t soft.'], [3, 'You don’t kick it.']]),
        R('ja-robo-2', 'Now the cake!', 'What cake does Robo like?', '🍫 chocolate|🍓 strawberry|🍋 lemon|🍌 banana', 1,
            [[0, 'It isn’t brown.'], [2, 'It isn’t sour.'], [3, 'Monkeys don’t love it.']]),
        R('ja-robo-3', 'Ding dong! A friend is at the door.', 'Who is the first friend?', '👽 alien|🦖 dinosaur|🧚 fairy|🐙 octopus', 0,
            [[1, 'It isn’t very big.'], [2, 'It hasn’t got wings.'], [3, 'It hasn’t got eight legs.']]),
        R('ja-robo-4', 'The friends want to play a game.', 'What do they play?', '🙈 hide and seek|⚽ football|🧩 puzzle|🎵 musical chairs', 0,
            [[1, 'They don’t need a ball.'], [2, 'They don’t sit at a table.'], [3, 'There isn’t any music.']]),
        R('ja-robo-5', 'Robo is thirsty.', 'What does Robo drink?', '🛢️ oil|🥛 milk|🧃 juice|☕ hot chocolate', 0,
            [[1, 'It isn’t white.'], [2, 'It isn’t from fruit.'], [3, 'It isn’t hot.']]),
        R('ja-robo-6', 'Time for the candles!', 'How many candles are on the cake?', '3️⃣ three|5️⃣ five|7️⃣ seven|🔟 ten', 2,
            [[0, 'There are more than four.'], [1, 'It isn’t the number of fingers on one hand.'], [3, 'There aren’t ten.']])
    ]),
    ADV('ja-bear', 'The Snow Bear', 'Little Bear wakes up. Everything is white! Help Little Bear in the snow.', 'Little Bear and new friends make a big snowman. What a great winter day!', [
        R('ja-bear-1', 'It is very cold.', 'What does Bear put on?', '🧣 scarf|🩳 shorts|👙 swimsuit|🕶️ sunglasses', 0,
            [[1, 'It isn’t for your legs.'], [2, 'You don’t wear it in the sea.'], [3, 'It isn’t for your eyes.']]),
        R('ja-bear-2', 'Bear goes outside.', 'Who is in the snow?', '🐧 penguin|🦒 giraffe|🐫 camel|🦁 lion', 0,
            [[1, 'It hasn’t got a long neck.'], [2, 'It doesn’t live in the desert.'], [3, 'It isn’t the king of the animals.']]),
        R('ja-bear-3', 'Bear and Penguin go down a hill. Wheee!', 'What do they ride?', '🛷 sledge|🛹 skateboard|🚲 bike|🛴 scooter', 0,
            [[1, 'It hasn’t got four little wheels.'], [2, 'It hasn’t got pedals.'], [3, 'It hasn’t got a long handle.']]),
        R('ja-bear-4', 'They find a lake with ice on it.', 'What is under the ice?', '🐟 fish|🐄 cow|🚗 car|🐦 bird', 0,
            [[1, 'It doesn’t give milk.'], [2, 'It hasn’t got wheels.'], [3, 'It hasn’t got wings.']]),
        R('ja-bear-5', 'Now Bear is hungry.', 'What does Bear eat?', '🍯 honey|🥕 carrot|🍕 pizza|🥦 broccoli', 0,
            [[1, 'It isn’t orange.'], [2, 'It isn’t round.'], [3, 'It isn’t green.']]),
        R('ja-bear-6', 'Bear and Penguin make a snowman.', 'What is the snowman’s nose?', '🥕 carrot|🍎 apple|🍌 banana|🪨 stone', 0,
            [[1, 'It isn’t red.'], [2, 'It isn’t yellow.'], [3, 'It isn’t grey.']])
    ]),
    ADV('ja-polly', 'Pirate Polly’s Island', 'Pirate Polly has got a map. Sail with Polly to Treasure Island!', 'Polly opens the box. Gold coins and a little gold crown! Yo ho ho!', [
        R('ja-polly-1', 'Polly needs a friend on the ship.', 'Who sails with Polly?', '🦜 parrot|🐒 monkey|🐶 dog|🐱 cat', 0,
            [[1, 'It doesn’t eat bananas all day.'], [2, 'It doesn’t say “Woof!”'], [3, 'It doesn’t say “Meow!”']]),
        R('ja-polly-2', 'The ship is ready.', 'What colour is the sail?', '⬜ white|🟥 red|🟩 green|🟦 blue', 1,
            [[0, 'It isn’t the colour of snow.'], [2, 'It isn’t the colour of grass.'], [3, 'It isn’t the colour of the sea.']]),
        R('ja-polly-3', 'At sea, Polly sees an animal.', 'What animal is it?', '🐳 whale|🐙 octopus|🦀 crab|🐢 turtle', 0,
            [[1, 'It hasn’t got eight legs.'], [2, 'It hasn’t got claws.'], [3, 'It isn’t slow.']]),
        R('ja-polly-4', 'Land! They walk on the island.', 'What is on the beach?', '🥥 coconut|🍎 apple|🍊 orange|🍐 pear', 0,
            [[1, 'It isn’t red.'], [2, 'It isn’t orange.'], [3, 'It isn’t green.']]),
        R('ja-polly-5', 'The map says: “Go to the big tree.”', 'Who is next to the big tree?', '🐍 snake|🐘 elephant|🐅 tiger|🐻 bear', 0,
            [[1, 'It hasn’t got a long nose.'], [2, 'It hasn’t got stripes.'], [3, 'It isn’t brown.']]),
        R('ja-polly-6', 'Dig, dig, dig! There’s a box!', 'What opens the box?', '🔑 key|🔨 hammer|✂️ scissors|🥄 spoon', 0,
            [[1, 'You don’t hit it.'], [2, 'You don’t cut with it.'], [3, 'You don’t eat with it.']])
    ])
];

export const RESERVE = [
    R('ja-r1', '', 'Which pet lives in the castle?', '🐱 cat|🐶 dog|🐟 fish|🐦 bird', 0,
        [[3, 'It can’t fly.'], [2, 'It has got legs.'], [1, 'It doesn’t say “Woof!”']]),
    R('ja-r2', '', 'Which fruit did the dragon eat?', '🍎 apple|🍌 banana|🍇 grapes|🍊 orange', 0,
        [[1, 'It isn’t yellow.'], [2, 'It isn’t purple.'], [3, 'It isn’t orange.']]),
    R('ja-r3', '', 'Which toy is in the box?', '🚗 car|🎈 balloon|⚽ ball|🧸 teddy', 3,
        [[0, 'It hasn’t got wheels.'], [1, 'It can’t fly.'], [2, 'You don’t kick it.']]),
    R('ja-r4', '', 'Who lives in the tower?', '👸 princess|🐉 dragon|🧙 wizard|🐱 cat', 2,
        [[1, 'It hasn’t got wings.'], [0, 'It hasn’t got a crown.'], [3, 'It doesn’t say “Meow!”']]),
    R('ja-r5', '', 'What is in the sky tonight?', '☀️ sun|🌙 moon|🌈 rainbow|☁️ cloud', 1,
        [[0, 'It isn’t hot.'], [2, 'It isn’t many colours.'], [3, 'It doesn’t bring rain.']]),
    R('ja-r6', '', 'Which animal is at the farm gate?', '🐄 cow|🐷 pig|🐑 sheep|🐔 chicken', 1,
        [[0, 'It doesn’t say “Moo!”'], [2, 'It doesn’t say “Baa!”'], [3, 'It has got four legs.']]),
    R('ja-r7', '', 'What is the knight wearing?', '🧢 cap|🧣 scarf|🧤 gloves|👟 shoes', 2,
        [[0, 'It isn’t on the head.'], [1, 'It isn’t on the neck.'], [3, 'It isn’t on the feet.']]),
    R('ja-r8', '', 'What takes the hero home?', '🚗 car|🚂 train|✈️ plane|⛵ boat', 1,
        [[2, 'It can’t fly.'], [3, 'It doesn’t go on water.'], [0, 'It doesn’t say “Beep beep!”']])
];
