# Vitalis

AI-платформа клинических протоколов: лендинг + форма заявок + MVP-кабинет (RAG + веб-поиск + GigaChat + DeepSeek).

## Стек

| Часть | Технология | Порт |
|---|---|---|
| Лендинг, форма, прокси | Node.js + Express | `3000` |
| AI / RAG / LLM | Python + FastAPI + FAISS | `8000` |
| Знания | Obsidian-vault (`vault/`) | — |

## Быстрый старт

### 1. Окружение

```bash
cp .env.example .env
```

Пока ключей нет — оставьте `LLM_MODE=mock` (ответы демо, RAG и веб-поиск работают).

### 2. Node (лендинг + форма)

```bash
npm install
npm start
```

- Лендинг: http://localhost:3000/
- Кабинет: http://localhost:3000/app

### 3. Python (AI API)

```bash
cd backend
py -3.12 -m venv .venv312
.venv312\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Проверка: http://localhost:8000/health · документация: http://localhost:8000/docs

## Форма заявок

`POST /api/leads` одновременно:

1. **Локально** — `server/data/leads.json` + SQLite `leads.db` (если доступен `node:sqlite`)
2. **Telegram** — `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
3. **Email** — SMTP (`SMTP_*` + `LEADS_EMAIL_TO`)

Каналы без ключей помечаются как `skipped`, заявка всё равно сохраняется локально.

## Аналитика

В `.env` задайте `YANDEX_METRIKA_ID` — счётчик инжектится в HTML.

Цели (reachGoal):

- `cta_click` — клик по CTA
- `lead_submit` — успешная заявка
- `ask_success` — успешный запрос в кабинете
- `protocol_tab_rf` / `protocol_tab_intl` — вкладки карточки

## Продукт (MVP)

`POST /api/ai/ask` → Python `/ask`:

1. Поиск по `vault/**/*.md` (FAISS + хеш-эмбеддинги)
2. Веб-поиск (`duckduckgo` по умолчанию; опционально Serper/Tavily)
3. **GigaChat** — РФ-протоколы (152-ФЗ)
4. **DeepSeek** — международное усиление

### Когда появятся ключи

В `.env`:

```env
LLM_MODE=live
GIGACHAT_CLIENT_ID=...
GIGACHAT_CLIENT_SECRET=...
DEEPSEEK_API_KEY=...
```

Перезапустите Python API.

### Пересобрать индекс vault

```bash
curl -X POST http://localhost:8000/rag/rebuild
```

Или через прокси: `POST http://localhost:3000/api/ai/rag/rebuild`

## Структура

```
├── public/index.html      # лендинг
├── web/app.html           # кабинет
├── server/                # Node Express
├── backend/app/           # FastAPI
├── vault/protocols/       # markdown-протоколы
├── .env.example
└── vitalis-documentation.md
```

## Дисклеймер

Vitalis не ставит диагнозы и не назначает лечение. Решение всегда за врачом.
