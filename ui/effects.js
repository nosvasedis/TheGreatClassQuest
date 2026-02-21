import { callGeminiApi } from '../api.js';
import * as state from '../state.js';

export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    let bgColor, icon;
    if (type === 'success') { bgColor = 'bg-green-500'; icon = '<i class="fas fa-check-circle"></i>'; }
    else if (type === 'error') { bgColor = 'bg-red-500'; icon = '<i class="fas fa-exclamation-triangle"></i>'; }
    else { bgColor = 'bg-blue-500'; icon = '<i class="fas fa-info-circle"></i>'; }
    toast.className = `transform transition-all duration-300 ease-out translate-y-[-20px] opacity-0 ${bgColor} text-white font-bold py-3 px-5 rounded-lg shadow-lg flex items-center space-x-3 pointer-events-auto ml-auto`;
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-[-20px]', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

export function showPraiseToast(message, icon = '✨') {
    const container = document.getElementById('toast-container');
    const wrapper = document.createElement('div');
    const isLeft = Math.random() > 0.5;
    wrapper.className = `w-full flex ${isLeft ? 'justify-start' : 'justify-end'} mb-3`;

    const toast = document.createElement('div');
    toast.className = "praise-toast pointer-events-auto";
    toast.innerHTML = `
        <div class="praise-toast-content">
            <div class="praise-toast-icon">${icon}</div>
            <div class="praise-toast-text">${message}</div>
        </div>
        <button class="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-lg">&times;</button>
    `;

    wrapper.appendChild(toast);
    container.appendChild(wrapper);

    const animateOut = (el) => {
        if (!el) return;
        const innerToast = el.querySelector('.praise-toast');
        if (!innerToast || innerToast.classList.contains('disappearing')) return;
        innerToast.classList.add('disappearing');
        setTimeout(() => el.remove(), 400);
    };

    toast.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        animateOut(wrapper);
    });
    setTimeout(() => animateOut(wrapper), 5000);
}

export async function showWelcomeBackMessage(firstName, stars) {
    const modal = document.getElementById('welcome-back-modal');
    const messageEl = document.getElementById('welcome-back-message');
    const starsEl = document.getElementById('welcome-back-stars');

    starsEl.textContent = stars;
    messageEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    modal.classList.remove('hidden');

    const systemPrompt = "You are the 'Quest Master' in a fun classroom game. You speak in short, exciting, single sentences. Do NOT use markdown or asterisks. Your job is to give a unique, positive welcome back message to a student who was absent. It must be one sentence only.";
    const userPrompt = `Generate a one-sentence welcome back message for a student named ${firstName}.`;

    try {
        const message = await callGeminiApi(systemPrompt, userPrompt);
        messageEl.textContent = message;
    } catch (e) {
        messageEl.textContent = `We're so glad you're back, ${firstName}!`;
    }

    setTimeout(() => {
        document.getElementById('welcome-back-modal').classList.add('hidden'); // Simplified hideModal
    }, 4000);
}

export function triggerDynamicPraise(studentName, starCount, reason) {
    const firstName = studentName.split(' ')[0];

    // 1. Get Gender from State (Cached from DB)
    const student = state.get('allStudents').find(s => s.name === studentName) || {};
    const g = student.gender === 'girl' ? 'girl' : 'boy';

    // --- PRE-DEFINED PERSONALIZED DATABASE ---
    const praiseDB = {
        // 1. TEAMWORK (Purple)
        teamwork: {
            color: "text-purple-600",
            1: {
                boy: ["Great helper, ${name}!", "Solid teammate!", "Good assist!"],
                girl: ["Great helper, ${name}!", "Solid teammate!", "Good assist!"]
            },
            2: {
                boy: ["You make the team stronger, ${name}!", "A true brother in arms!", "Excellent cooperation!"],
                girl: ["You make the team stronger, ${name}!", "A true sister in arms!", "Excellent cooperation!"]
            },
            3: {
                boy: ["THE KING OF COOPERATION! The guild salutes you!", "A Legendary Ally!", "The team's MVP!"],
                girl: ["THE QUEEN OF COOPERATION! The guild salutes you!", "A Legendary Ally!", "The team's MVP!"]
            }
        },
        // 2. CREATIVITY (Pink)
        creativity: {
            color: "text-pink-600",
            1: {
                boy: ["Cool idea, ${name}!", "Nice thinking!", "Creative spark!"],
                girl: ["Cool idea, ${name}!", "Nice thinking!", "Creative spark!"]
            },
            2: {
                boy: ["Brilliant imagination, sir!", "What a clever mind!", "Colorful thinking!"],
                girl: ["Brilliant imagination, miss!", "What a clever mind!", "Colorful thinking!"]
            },
            3: {
                boy: ["A VISIONARY GENIUS! Your mind is a galaxy!", "Master Inventor!", "Pure Magic!"],
                girl: ["A VISIONARY GENIUS! Your mind is a galaxy!", "Mistress of Invention!", "Pure Magic!"]
            }
        },
        // 3. RESPECT (Green)
        respect: {
            color: "text-green-600",
            1: {
                boy: ["Very polite, ${name}.", "Respectful choice.", "Kind heart."],
                girl: ["Very polite, ${name}.", "Respectful choice.", "Kind heart."]
            },
            2: {
                boy: ["A true gentleman!", "You earn respect by giving it!", "Honorable behavior!"],
                girl: ["A true lady!", "You earn respect by giving it!", "Honorable behavior!"]
            },
            3: {
                boy: ["A PARAGON OF VIRTUE! A Knight of Honor!", "The heart of a Hero!", "Maximum Respect!"],
                girl: ["A PARAGON OF VIRTUE! A Knight of Honor!", "The heart of a Heroine!", "Maximum Respect!"]
            }
        },
        // 4. FOCUS (Yellow/Amber)
        focus: {
            color: "text-amber-600",
            1: {
                boy: ["Sharp eyes, ${name}!", "Good focus.", "On target."],
                girl: ["Sharp eyes, ${name}!", "Good focus.", "On target."]
            },
            2: {
                boy: ["Laser concentration!", "Nothing gets past him!", "Locked in!"],
                girl: ["Laser concentration!", "Nothing gets past her!", "Locked in!"]
            },
            3: {
                boy: ["UNBREAKABLE WILL! Nothing distracts him!", "The Eye of the Tiger!", "Hyper-Focus Achieved!"],
                girl: ["UNBREAKABLE WILL! Nothing distracts her!", "The Eye of the Tiger!", "Hyper-Focus Achieved!"]
            }
        },
        // 5. GENERIC / OTHER (Blue)
        default: {
            color: "text-blue-600",
            1: {
                boy: ["Well done, ${name}!", "Good job!", "Nice work!"],
                girl: ["Well done, ${name}!", "Good job!", "Nice work!"]
            },
            2: {
                boy: ["Awesome effort, ${name}!", "He's leveling up!", "Way to go!"],
                girl: ["Awesome effort, ${name}!", "She's leveling up!", "Way to go!"]
            },
            3: {
                boy: ["SPECTACULAR! He is on fire today!", "Quest Crushed!", "A Legend is born!"],
                girl: ["SPECTACULAR! She is on fire today!", "Quest Crushed!", "A Legend is born!"]
            }
        }
    };

    // Select category and star level
    const category = praiseDB[reason] || praiseDB['default'];
    const countKey = Math.min(starCount, 3);

    // Select gender-specific array
    const messages = category[countKey][g];

    // Pick random message
    const rawMessage = messages[Math.floor(Math.random() * messages.length)];
    const message = rawMessage.replace("${name}", firstName);

    // Determine Icon
    let icon = '✨';
    if (starCount === 2) icon = '🌟';
    if (starCount >= 3) icon = '🏆';

    // Stylize
    const styledMessage = `<span class="${category.color} font-bold">${message}</span>`;

    // Trigger
    showPraiseToast(styledMessage, icon);
}

export function triggerAwardEffects(button, starCount) {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const colors = {
        1: ['#06b6d4', '#38bdf8', '#7dd3fc'],
        2: ['#a855f7', '#d8b4fe', '#f472b6'],
        3: ['#f97316', '#fbbf24', '#fde047']
    };

    const effectConfig = {
        1: { particles: 15, size: [2, 5], distance: [30, 60] },
        2: { particles: 30, size: [3, 7], distance: [50, 100], shockwave: 'rgba(216, 180, 254, 0.7)' },
        3: { particles: 60, size: [4, 9], distance: [80, 150], flash: 'rgba(249, 115, 22, 0.3)', shockwave: 'rgba(251, 191, 36, 0.8)' }
    };

    const config = effectConfig[starCount];
    const particleColors = colors[starCount];

    for (let i = 0; i < config.particles; i++) {
        const particle = document.createElement('div');
        particle.className = 'award-particle';
        document.body.appendChild(particle);

        const size = Math.random() * (config.size[1] - config.size[0]) + config.size[0];
        const angle = Math.random() * 360;
        const distance = Math.random() * (config.distance[1] - config.distance[0]) + config.distance[0];
        const tx = Math.cos(angle * (Math.PI / 180)) * distance;
        const ty = Math.sin(angle * (Math.PI / 180)) * distance;

        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.background = particleColors[Math.floor(Math.random() * particleColors.length)];
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);

        particle.addEventListener('animationend', () => particle.remove());
    }

    if (config.flash) {
        const flash = document.createElement('div');
        flash.className = 'screen-flash';
        flash.style.setProperty('--flash-color', config.flash);
        document.body.appendChild(flash);
        flash.addEventListener('animationend', () => flash.remove());
    }

    if (config.shockwave) {
        const shockwave = document.createElement('div');
        shockwave.className = 'shockwave';
        shockwave.style.left = `${x}px`;
        shockwave.style.top = `${y}px`;
        shockwave.style.setProperty('--shockwave-color', config.shockwave);
        document.body.appendChild(shockwave);
        shockwave.addEventListener('animationend', () => shockwave.remove());
    }
}

export function createFloatingHearts(x, y) {
    const numHearts = 8 + Math.floor(Math.random() * 5); // 8 to 12 hearts

    for (let i = 0; i < numHearts; i++) {
        const heart = document.createElement('i');
        heart.className = 'fas fa-heart absolute text-rose-500 z-[100] pointer-events-none drop-shadow-md';

        const size = 16 + Math.random() * 24; // 16px to 40px
        heart.style.fontSize = `${size}px`;
        heart.style.left = `${x}px`;
        heart.style.top = `${y}px`;

        const tx = (Math.random() - 0.5) * 150; // -75px to 75px horizontal
        const ty = -100 - Math.random() * 150; // -100px to -250px vertical
        const rot = (Math.random() - 0.5) * 90; // Rotation
        const duration = 1 + Math.random() * 1.5; // 1s to 2.5s

        heart.style.setProperty('--tx', `${tx}px`);
        heart.style.setProperty('--ty', `${ty}px`);
        heart.style.setProperty('--rot', `${rot}deg`);

        heart.style.animation = `float-up-heart ${duration}s ease-out forwards`;

        document.body.appendChild(heart);

        heart.addEventListener('animationend', () => heart.remove());
    }
}
