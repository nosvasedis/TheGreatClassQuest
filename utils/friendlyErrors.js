// utils/friendlyErrors.js — turns Firebase's technical errors into sentences a teacher,
// parent or secretary can act on. Raw codes such as "Error (auth/invalid-credential)"
// never reach the screen; messages the server already wrote for people pass through.

const ROLE_WORDS = {
    teacher: {
        id: 'email',
        idCapital: 'Email',
        help: 'Check for a typo, or use “Forgot password?” to get a reset link.'
    },
    parent: {
        id: 'username',
        idCapital: 'Username',
        help: 'Copy them exactly as the school gave them. If it still fails, ask your child’s teacher or the school office for a new password.'
    },
    secretary: {
        id: 'username',
        idCapital: 'Username',
        help: 'Use the username chosen when the school was activated.'
    }
};

function roleWords(role) {
    return ROLE_WORDS[role] || ROLE_WORDS.teacher;
}

/** The bare code of a Firebase error ("auth/invalid-credential", "functions/internal"), or ''. */
export function getErrorCode(error) {
    const code = String(error?.code || '').trim();
    if (code) return code;
    const match = String(error?.message || error || '').match(/\(((?:auth|functions|firestore|storage)\/[a-z0-9-]+)\)/i);
    return match ? match[1].toLowerCase() : '';
}

/** True when a message still looks like something only a developer should read. */
export function looksTechnical(message) {
    const text = String(message || '').trim();
    if (!text) return true;
    return /^firebase\b|\((?:auth|functions|firestore|storage)\/|^(?:internal|unknown|unavailable|deadline-exceeded|permission-denied|not-found|invalid-argument|failed-precondition|resource-exhausted|unauthenticated|cancelled|aborted|already-exists|out-of-range|data-loss)$|missing or insufficient permissions|failed to fetch|networkerror|load failed|typeerror|referenceerror|undefined is not|cannot read propert/i.test(text);
}

const AUTH_MESSAGES = {
    'auth/invalid-credential': (w) => ({
        field: 'password',
        title: `That ${w.id} and password don’t match`,
        text: w.help
    }),
    'auth/invalid-login-credentials': (w) => AUTH_MESSAGES['auth/invalid-credential'](w),
    'auth/wrong-password': (w) => AUTH_MESSAGES['auth/invalid-credential'](w),
    'auth/user-not-found': (w) => ({
        field: 'id',
        title: `We couldn’t find that ${w.id}`,
        text: w.help
    }),
    'auth/invalid-email': (w) => ({
        field: 'id',
        title: w.id === 'email' ? 'That email address doesn’t look right' : 'That username doesn’t look right',
        text: w.id === 'email' ? 'It should look like name@example.com.' : 'Usernames use letters, numbers, dots or dashes, with no spaces.'
    }),
    'auth/missing-email': (w) => ({
        field: 'id',
        title: `Please enter your ${w.id}`,
        text: ''
    }),
    'auth/missing-password': () => ({
        field: 'password',
        title: 'Please enter your password',
        text: ''
    }),
    'auth/user-disabled': (w, role) => ({
        field: 'id',
        title: 'This login is switched off',
        text: role === 'parent'
            ? 'The school has paused this family login. Contact your child’s teacher or the school office to turn it back on.'
            : 'Contact the school office to turn it back on.'
    }),
    'auth/too-many-requests': () => ({
        field: 'password',
        title: 'Too many tries in a row',
        text: 'For safety, sign-in is paused for a few minutes. Wait a moment, then try again.'
    }),
    'auth/network-request-failed': () => ({
        field: '',
        title: 'No internet connection',
        text: 'Check the Wi-Fi or mobile data, then try again.'
    }),
    'auth/email-already-in-use': () => ({
        field: 'email',
        title: 'This email already has an account',
        text: 'Switch to “Sign in” and use it there, or reset the password if you forgot it.'
    }),
    'auth/weak-password': () => ({
        field: 'password',
        title: 'Choose a longer password',
        text: 'Use at least 6 characters. A short phrase is easy to remember and hard to guess.'
    }),
    'auth/operation-not-allowed': () => ({
        field: '',
        title: 'Sign-in isn’t switched on for this school yet',
        text: 'Please contact the school office.'
    }),
    'auth/requires-recent-login': () => ({
        field: 'password',
        title: 'Please sign in again first',
        text: 'For safety, this change needs a fresh sign-in.'
    }),
    'auth/internal-error': () => ({
        field: '',
        title: 'Something went wrong on our side',
        text: 'Please try again in a moment.'
    }),
    'auth/web-storage-unsupported': () => ({
        field: '',
        title: 'This browser is blocking sign-in',
        text: 'Turn off private browsing, or open the app in Chrome or Safari.'
    })
};

/**
 * A friendly { title, text, field } for a sign-in problem.
 * field is 'id' (email/username), 'password', 'email', 'name', or '' so the form can point at it.
 */
export function friendlyAuthError(error, { role = 'teacher' } = {}) {
    const words = roleWords(role);
    const code = getErrorCode(error);
    const build = AUTH_MESSAGES[code];
    if (build) return build(words, role);
    if (code.startsWith('functions/')) {
        return { field: '', title: friendlyActionError(error), text: '' };
    }
    const raw = String(error?.message || error || '').replace(/^Firebase:\s*/i, '').trim();
    if (raw && !looksTechnical(raw)) return { field: '', title: raw, text: '' };
    return {
        field: '',
        title: 'We couldn’t sign you in',
        text: 'Please check your details and try again.'
    };
}

const FUNCTION_FALLBACKS = {
    'functions/unavailable': 'The school server can’t be reached right now. Check the internet connection and try again.',
    'functions/deadline-exceeded': 'That took too long to finish. Please try again.',
    'functions/internal': 'Something went wrong on our side. Please try again in a moment.',
    'functions/unknown': 'Something went wrong on our side. Please try again in a moment.',
    'functions/unauthenticated': 'Your sign-in has expired. Please sign out and sign in again.',
    'functions/permission-denied': 'Your account isn’t allowed to do that.',
    'functions/resource-exhausted': 'Too many requests at once. Wait a minute, then try again.',
    'functions/not-found': 'That record couldn’t be found. It may have been removed already.',
    'functions/already-exists': 'That already exists. Try a different name.',
    'functions/invalid-argument': 'Some details are missing or not quite right. Please check and try again.',
    'functions/failed-precondition': 'This can’t be done right now.',
    'functions/cancelled': 'That was cancelled before it finished.'
};

/**
 * A plain sentence for any failed action (callable, Firestore, network).
 * Messages the server wrote for people are kept; technical ones are replaced.
 */
export function friendlyActionError(error, fallback = 'Something went wrong. Please try again.') {
    const code = getErrorCode(error);
    const raw = String(error?.message || error || '').replace(/^Firebase:\s*/i, '').trim();
    if (code.startsWith('auth/')) {
        const { title, text } = friendlyAuthError(error);
        return text ? `${title}. ${text}` : title;
    }
    if (raw && !looksTechnical(raw) && raw.toLowerCase() !== code.replace(/^[a-z]+\//, '')) return raw;
    if (FUNCTION_FALLBACKS[code]) return FUNCTION_FALLBACKS[code];
    if (/permission/i.test(raw) || code === 'firestore/permission-denied') return 'Your account isn’t allowed to do that.';
    if (/fetch|network|load failed|offline/i.test(raw) || code === 'firestore/unavailable') {
        return 'No internet connection. Check the Wi-Fi or mobile data, then try again.';
    }
    return fallback;
}
