// A tiny in-memory Stripe for testing scripts/stripe-setup.mjs (loaded with node --import).
// State is kept in the JSON file named by FAKE_STRIPE_STATE so a second run sees the first.
import fs from 'node:fs';

const stateFile = process.env.FAKE_STRIPE_STATE;
const load = () => (fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { seq: 0, objects: {}, calls: [] });
const save = (state) => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

// Turns a[b][0][c]=x form keys into nested objects/arrays.
function parseForm(text) {
    const out = {};
    for (const [rawKey, value] of new URLSearchParams(text || '')) {
        const keys = rawKey.replace(/\]/g, '').split('[');
        let node = out;
        keys.forEach((key, i) => {
            const last = i === keys.length - 1;
            const nextIsIndex = !last && /^\d+$/.test(keys[i + 1]);
            if (last) node[key] = value;
            else node = node[key] ??= nextIsIndex ? [] : {};
        });
    }
    return out;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname !== 'api.stripe.com') throw new Error(`unexpected host ${url.hostname}`);
    const state = load();
    const method = init.method || 'GET';
    const apiPath = url.pathname.replace('/v1', '');
    const body = method === 'GET' ? parseForm(url.search.slice(1)) : parseForm(init.body);
    state.calls.push(`${method} ${apiPath}`);
    const [, kind, id, action] = apiPath.split('/');
    const resource = kind === 'billing_portal' ? 'billing_portal/configurations' : kind;
    const objectId = kind === 'billing_portal' ? action : id;
    const all = (state.objects[resource] ??= []);
    const create = (prefix, fields) => {
        state.seq += 1;
        const object = { id: `${prefix}_${state.seq}`, active: true, metadata: {}, ...fields };
        all.push(object);
        return object;
    };
    let response;
    if (apiPath === '/account') response = json({ id: 'acct_test', settings: { dashboard: { display_name: 'GCQ Test' } } });
    else if (method === 'GET' && !objectId) {
        let data = all.filter((item) => item.active !== false || body.active === undefined);
        if (body.active === 'true') data = data.filter((item) => item.active !== false);
        if (body.lookup_keys) data = data.filter((item) => item.lookup_key === body.lookup_keys[0]);
        if (body.code) data = data.filter((item) => item.code === body.code);
        response = json({ data, has_more: false });
    } else if (method === 'GET' && objectId) {
        const found = all.find((item) => item.id === objectId);
        response = found ? json(found) : json({ error: { message: 'No such object' } }, 404);
    } else if (method === 'DELETE') {
        state.objects[resource] = all.filter((item) => item.id !== objectId);
        response = json({ id: objectId, deleted: true });
    } else if (method === 'POST' && objectId) {
        const found = all.find((item) => item.id === objectId);
        Object.assign(found, body, body.active === 'false' ? { active: false } : {});
        response = json(found);
    } else {
        const prefixes = { tax_rates: 'txr', products: 'prod', prices: 'price', coupons: 'coupon', promotion_codes: 'promo', 'billing_portal/configurations': 'bpc', webhook_endpoints: 'we' };
        const fields = { ...body };
        if (resource === 'prices') {
            fields.unit_amount = Number(body.unit_amount);
            fields.recurring = { interval: body.recurring.interval };
            if (body.transfer_lookup_key === 'true') all.forEach((item) => { if (item.lookup_key === body.lookup_key) item.lookup_key = null; });
        }
        if (resource === 'coupons') fields.id = body.id;
        if (resource === 'webhook_endpoints') fields.secret = 'whsec_from_fake';
        const object = create(prefixes[resource] || 'obj', fields);
        if (fields.id && resource === 'coupons') object.id = fields.id;
        response = json(object);
    }
    save(state);
    return response;
};
