require('dotenv').config();
const express = require('express');
const path = require('path');
const { getCustomerByLookup, warmUpCache, cacheInfo } = require('./lib/loyverseClient');

const app = express();
const PORT = process.env.PORT || 3000;

const hits = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (arr.length > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ success: false, message_en: 'Too many requests, please wait a minute.', message_ar: 'طلبات كثيرة جدًا، الرجاء الانتظار دقيقة.' });
  }
  next();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/search', rateLimit, async (req, res) => {
  const query = (req.query.query || '').toString().trim();

  if (!query || query.length < 3) {
    return res.status(400).json({
      success: false,
      message_en: 'Please enter a valid phone number or customer code.',
      message_ar: 'الرجاء إدخال رقم هاتف أو رمز عميل صحيح.',
    });
  }

  try {
    const customer = await getCustomerByLookup(query);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message_en: 'No customer found. Please check your phone number / code, or ask our staff to register you.',
        message_ar: 'لم يتم العثور على عميل. الرجاء التحقق من رقم الهاتف / الرمز، أو اطلب من الموظف تسجيلك.',
      });
    }

    return res.json({
      success: true,
      name: customer.displayName,
      points: customer.total_points ?? 0,
      total_spent: customer.total_spent ?? null,
    });
  } catch (err) {
    console.error('Search error:', err.message);
    return res.status(502).json({
      success: false,
      message_en: 'Could not reach the loyalty system. Please try again in a moment.',
      message_ar: 'تعذر الوصول إلى نظام الولاء. الرجاء المحاولة مرة أخرى بعد قليل.',
    });
  }
});

app.post('/api/redeem', rateLimit, async (req, res) => {
  return res.status(501).json({
    success: false,
    message_en: 'Reward redemption is not enabled yet. Please ask our staff at the counter.',
    message_ar: 'ميزة استبدال النقاط غير مفعّلة بعد. الرجاء سؤال الموظف عند الكاونتر.',
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, cache: cacheInfo() });
});

app.listen(PORT, () => {
  console.log(`LOCKER Coffee loyalty app running on port ${PORT}`);
  warmUpCache();
});
