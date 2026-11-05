// anthem-video-preview.js — dev preview for the guild anthem music videos (ui/modals/anthemVideo.js).
import { openAnthemVideo, getAnthemVideoSession } from './ui/modals/anthemVideo.js';

const params = new URLSearchParams(location.search);
const lite = params.has('lite') ? params.get('lite') === '1' : undefined;

document.querySelectorAll('[data-guild]').forEach(btn => {
    btn.addEventListener('click', () => openAnthemVideo(btn.dataset.guild, { lite }));
});

const guild = params.get('guild');
if (guild) {
    openAnthemVideo(guild, { lite }).then(() => {
        const s = getAnthemVideoSession();
        if (!s) return;
        const t = Number(params.get('t'));
        const hold = params.get('hold') === '1';
        const seekTo = () => {
            if (Number.isFinite(t) && t > 0) s.audio.currentTime = t;
            if (hold) {
                s.audio.pause();
                // keep the scene's loops and one-shots running so a held moment looks like playback
                setTimeout(() => s.stage.classList.remove('av--paused'), 50);
            }
        };
        if (s.audio.readyState >= 1) seekTo();
        else s.audio.addEventListener('loadedmetadata', seekTo, { once: true });
    });
}
