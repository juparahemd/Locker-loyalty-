const LOYVERSE_TOKEN = process.env.LOYVERSE_ACCESS_TOKEN;
const BASE_URL = 'https://api.loyverse.com/v1.0';
const REFRESH_MINUTES = parseInt(process.env.CACHE_REFRESH_MINUTES || '3', 10);
const MAX_PAGES = 40;

if (!LOYVERSE_TOKEN) {
  console.warn('[WARNING] LOYVERSE_ACCESS_TOKEN is not set in your .env file yet.');
}

let byPhone = new Map();
let byCode = new Map();
let lastLoadedAt = null;
let isLoading = false;

function normalizePhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.slice(-9);
}

async function loyverseFetch(pathname, params = {}) {
  const url = new URL(BASE_URL + pathname);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${LOYVERSE_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Loyverse API error ${resp.status}: ${body}`);
  }
  return resp.json();
}

async function fetchAllCustomers() {
  let all = [];
  let cursor = undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await loyverseFetch('/customers', { limit: 250, cursor });
    const items = data.customers || [];
    all = all.concat(items);
    cursor = data.cursor;
    if (!cursor || items.length === 0) break;
  }
  return all;
}

async function warmUpCache() {
  if (isLoading) return;
  isLoading = true;
  try {
    const customers = await fetchAllCustomers();
    const nextByPhone = new Map();
    const nextByCode = new Map();

    for (const c of customers) {
      const displayName = c.name || c.first_name || 'Customer';
      const record = {
        displayName,
        total_points: c.total_points,
        total_spent: c.total_spent,
      };
      if (c.phone_number) {
        nextByPhone.set(normalizePhone(c.phone_number), record);
      }
      if (c.customer_code) {
        nextByCode.set(String(c.customer_code).trim().toUpperCase(), record);
      }
    }

    byPhone = nextByPhone;
    byCode = nextByCode;
    lastLoadedAt = new Date();
    console.log(`[loyverseClient] Cache refreshed: ${customers.length} customers loaded at ${lastLoadedAt.toISOString()}`);
  } catch (err) {
    console.error('[loyverseClient] Failed to refresh customer cache:', err.message);
  } finally {
    isLoading = false;
  }
}

setInterval(warmUpCache, REFRESH_MINUTES * 60 * 1000);

async function getCustomerByLookup(query) {
  const trimmed = query.trim();

  const byCodeMatch = byCode.get(trimmed.toUpperCase());
  if (byCodeMatch) return byCodeMatch;

  const normalized = normalizePhone(trimmed);
  if (normalized.length >= 7) {
    const byPhoneMatch = byPhone.get(normalized);
    if (byPhoneMatch) return byPhoneMatch;
  }

  if (!lastLoadedAt) {
    await warmUpCache();
    return getCustomerByLookupOnce(trimmed, normalized);
  }

  return null;
}

function getCustomerByLookupOnce(trimmed, normalized) {
  return byCode.get(trimmed.toUpperCase()) || byPhone.get(normalized) || null;
}

function cacheInfo() {
  return {
    customers_cached: byPhone.size + byCode.size,
    last_loaded_at: lastLoadedAt,
    refresh_interval_minutes: REFRESH_MINUTES,
  };
}

module.exports = { getCustomerByLookup, warmUpCache, cacheInfo };
