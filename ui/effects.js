import { callGeminiApi } from '../api.js';

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

export async function triggerDynamicPraise(studentName, starCount, reason) {
    const firstName = studentName.split(' ')[0];
    const starText = starCount === 1 ? "1 star" : `${starCount} stars`;
    const systemPrompt = "You are the 'Quest Master' in a fun classroom game. You speak in short, exciting, game-like single sentences. Do NOT use markdown or asterisks. Your job is to give a unique, positive praise message to a student who just earned stars for a specific reason. The praise should be one sentence only.";
    const userPrompt = `Generate a one-sentence praise for a student named ${firstName} who just earned ${starText} for demonstrating excellent ${reason}.`;
    try {
        const praise = await callGeminiApi(systemPrompt, userPrompt);
        if (praise) showPraiseToast(praise, '✨');
    } catch (error) { console.error('Gemini Praise Error:', error); }
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
