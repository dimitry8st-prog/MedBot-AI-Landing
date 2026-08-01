'use strict';

const { Router } = require('express');
const crypto = require('crypto');
const { saveLocal } = require('../services/store');
const { sendTelegram } = require('../services/telegram');
const { sendEmail } = require('../services/email');

const router = Router();

function validate(body) {
  const errors = {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const role = String(body.role || '').trim();
  const tariff = String(body.tariff || '').trim();
  const comment = String(body.comment || '').trim();

  if (!name) errors.name = 'Укажите имя';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Укажите корректный email';
  if (!role) errors.role = 'Выберите роль';

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: { name, email, role, tariff, comment },
  };
}

router.post('/', async (req, res) => {
  const v = validate(req.body || {});
  if (!v.ok) {
    return res.status(400).json({ ok: false, errors: v.errors });
  }

  const lead = {
    id: crypto.randomUUID(),
    ...v.data,
    createdAt: new Date().toISOString(),
    source: 'landing',
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
  };

  const channels = { local: null, telegram: null, email: null };

  try {
    channels.local = { ok: true, ...saveLocal(lead) };
  } catch (e) {
    channels.local = { ok: false, reason: e.message };
  }

  try {
    channels.telegram = await sendTelegram(lead);
  } catch (e) {
    channels.telegram = { ok: false, skipped: false, reason: e.message };
  }

  try {
    channels.email = await sendEmail(lead);
  } catch (e) {
    channels.email = { ok: false, skipped: false, reason: e.message };
  }

  const localOk = channels.local && channels.local.ok;
  if (!localOk) {
    return res.status(500).json({
      ok: false,
      message: 'Не удалось сохранить заявку локально',
      channels,
    });
  }

  // Цель Метрики (клиент тоже шлёт reachGoal)
  res.json({
    ok: true,
    id: lead.id,
    message: 'Заявка принята',
    channels,
  });
});

module.exports = router;
