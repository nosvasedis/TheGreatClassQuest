export function createConcurrencyQueue(limit) {
    const max = Math.max(1, Number(limit) || 1);
    let active = 0;
    const waiting = [];

    async function acquire() {
        if (active < max) {
            active += 1;
            return;
        }
        await new Promise((resolve) => waiting.push(resolve));
        active += 1;
    }

    function release() {
        active = Math.max(0, active - 1);
        const next = waiting.shift();
        if (next) next();
    }

    return async function run(task) {
        await acquire();
        try {
            return await task();
        } finally {
            release();
        }
    };
}
