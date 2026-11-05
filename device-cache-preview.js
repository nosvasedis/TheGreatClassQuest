// Keep Devices Fast preview: the real first-sign-in prompt, nothing saved between reloads.
// /device-cache-preview.html?role=teacher|secretary|parent[&shot=1]
import { offerDeviceCacheChoice } from './utils/deviceCache.js';

const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('pv-shot');
try { localStorage.removeItem('gcq_device_cache_choice_v1'); } catch (_) { /* preview only */ }
offerDeviceCacheChoice(params.get('role') || 'teacher');
