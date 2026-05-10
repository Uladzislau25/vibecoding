# Техническое задание — ChefBot

**Версия:** 1.0
**Дата:** 2026-05-10
**Статус:** Реализовано (документация воспроизводит текущий продакшн-функционал)

---

## 1. Назначение и цели

### 1.1 Назначение
**ChefBot** — кулинарный ассистент в Telegram с поддержкой эскалации на живого менеджера и админ-панелью для команды поддержки. Бот подбирает рецепты по запросу, использует семантический поиск по уже сгенерированным рецептам и LLM (DeepSeek) для генерации новых, помнит дневник предпочтений пользователя, ведёт историю диалогов, собирает оценки и избранное.

### 1.2 Бизнес-цели
- Снизить нагрузку на службу поддержки за счёт автоматических ответов на типовые кулинарные вопросы.
- Обеспечить плавную эскалацию (бот → менеджер → бот) без потери контекста диалога.
- Накапливать базу рецептов и предпочтений пользователей для персонализации ответов.

### 1.3 Не является целью (out of scope)
- Платные подписки и платежи.
- Доставка продуктов / интеграции с маркетплейсами.
- Мобильное приложение (только Telegram + веб-админка).
- Голосовые сообщения, фото/видео-распознавание ингредиентов.

---

## 2. Глоссарий

| Термин | Определение |
| --- | --- |
| **Клиент** | Конечный пользователь Telegram, переписывающийся с ботом (`clients`). |
| **Менеджер** | Сотрудник поддержки с ролью `manager` или `admin`, авторизованный в админ-панели. |
| **Администратор** | Менеджер с ролью `admin`, может управлять ролями других менеджеров. |
| **Эскалация** | Перевод диалога с бота на менеджера. Состояния: `normal`, `escalated`, `manager_active`. |
| **Назначение (assignment)** | Связка клиент ↔ ответственный менеджер (1:1) в `client_assignments`. |
| **Recipe** | Сгенерированный или добавленный вручную рецепт с эмбеддингом (BGE-M3, 1024). |
| **Embedding** | Векторное представление текста (`vector(1024)`), используется для семантического поиска через `pgvector`. |
| **Idempotency** | Защита от двойной обработки одного Telegram update'а через `messages.telegram_message_id` (UNIQUE). |
| **Setup state** | Многошаговый диалог-флоу клиента (`clients.setup_state`), напр. `awaiting_preferences`. |
| **RLS** | Row-Level Security — политики доступа Supabase Postgres на уровне строк. |

---

## 3. Роли и права

| Роль | Где задаётся | Права |
| --- | --- | --- |
| **client** | Telegram, автоматический upsert при первом сообщении | Писать боту, нажимать inline-кнопки. |
| **user** (managers.role) | Зарегистрированный через Google OAuth, но без прав | Войти в `/login`. Доступ к рабочим разделам закрыт. |
| **manager** | `managers.role = 'manager'` | Видеть все чаты, отвечать клиентам, назначать менеджеров, редактировать теги/заметки/настройки чата, добавлять рецепты. |
| **admin** | `managers.role = 'admin'` (вручную через Supabase Dashboard) | Всё, что может `manager`, плюс изменение ролей в `/admin`. |

**Принципы:**
- Аутентификация только через Google OAuth.
- При первом входе создаётся запись в `managers` с `role = 'user'`. Дальнейший апгрейд — вручную через Dashboard или через `/admin` (только admin).
- Все операции записи в БД из админ-панели идут от имени `authenticated`-пользователя и фильтруются RLS-политиками через `get_my_role()`.

---

## 4. Функциональные требования

### 4.1 Telegram-бот (для клиента)

#### FR-1. Регистрация / приветствие
- При `/start` бот отправляет приветственное сообщение и **reply-keyboard** с кнопками: `🎲 Случайный рецепт`, `⭐ Избранное`, `🛒 Список покупок`, `⚙️ Предпочтения`. Эти кнопки маппятся в команды `/random`, `/saved`, `/list`, `/preferences`.
- При первом сообщении (не `/start`) клиент `upsert` в `clients` (`chat_id` уникален). Если `status = 'closed'` — переводится в `'open'`.

#### FR-2. Свободный диалог
- Бот сохраняет каждое входящее сообщение в `messages` (`sender_type = 'client'`) с `telegram_message_id` для идемпотентности.
- Если сообщение распознано как **casual** (приветствие / благодарность / прощание) — отвечает случайной фразой из соответствующего набора и не вызывает LLM.
- Иначе запускается **recipe-flow** (см. FR-6).

#### FR-3. Команды
| Команда | Поведение |
| --- | --- |
| `/start` | Приветствие + меню. |
| `/preferences` | Показать текущие предпочтения. Если их нет — переводит клиента в `setup_state = 'awaiting_preferences'` и ждёт следующего сообщения. Ответ "нет" — сбрасывает. |
| `/save` | Сохранить **последний показанный** рецепт в `client_favorite_recipes` (источник — `messages.recipe_id` последнего бот-сообщения). |
| `/saved` | Список избранных рецептов. |
| `/list` | Список покупок: формирует из ингредиентов **последнего показанного** рецепта. |
| `/random` | Случайный рецепт из `recipes` (RANDOM). |
| `/week` | Меню на неделю — 7 случайных рецептов из разных категорий. |

#### FR-4. Inline-клавиатуры (callback_query)
- **Recipe keyboard** под каждым рецептом: `👍` (`rate:<id>:1`), `👎` (`rate:<id>:-1`), `⭐ Сохранить` (`save:<id>`).
  - `rate:*` → upsert в `recipe_ratings`.
  - `save:*` → insert в `client_favorite_recipes`.
- **Clarify keyboard** — варианты для уточнения запроса (генерируются LLM, до 4 кнопок).

#### FR-5. Rate-limit
- Не более **20 сообщений в час** с `sender_type = 'client'` от одного клиента. При превышении — сообщение «⏳ Слишком много запросов» и блокировка ответа на час.

#### FR-6. Recipe-flow (генерация / поиск рецепта)
1. Собирается контекст: последние 10 сообщений + предпочтения (`client_preferences.dietary_notes`) + персонализированный system prompt + порции (если в тексте).
2. Эмбеддинг запроса (Jina BGE-M3, режим `query`) → `search_recipes(embedding, query_text, 1)`.
3. Если `similarity ≥ 0.88` — вернуть готовый рецепт, прикрепить recipe-keyboard.
4. Иначе — вызов **DeepSeek** (`deepseek-v4-flash` по умолчанию) с structured output:
   - `need_clarification: true` → отправить вопрос с clarify-keyboard.
   - `can_help: false` → перевести клиента в `escalation_status = 'escalated'`, `escalated_at = now()`, отправить ESCALATION_MESSAGE.
   - `can_help: true` → создать эмбеддинг (режим `passage`), `INSERT recipes`, отправить рецепт с recipe-keyboard. При конфликте `UNIQUE` (по нормализованному title) — переиспользовать существующий.
5. Сохранить ответ бота в `messages` с `recipe_id` и счётом токенов (`prompt_tokens`, `completion_tokens`, `total_tokens`).

#### FR-7. Эскалация
- При `escalation_status in ('escalated', 'manager_active')` бот **молчит**: входящее сообщение по-прежнему сохраняется в `messages`, но recipe-flow не запускается.
- При первом ответе менеджера через `admin-reply` (см. FR-12) `escalated → manager_active` + системное сообщение клиенту: «С вами сейчас работает наш специалист».
- При нажатии `Вернуть боту` менеджером — `manager_active → normal`, бот снова отвечает.

### 4.2 Админ-панель (для менеджера / админа)

#### FR-8. Аутентификация
- `/login` — кнопка «Войти через Google».
- Forgot/Reset password — заглушки на случай сброса пароля для legacy-аккаунтов (Email/Password не основной сценарий).
- Защита маршрутов: middleware/`getUser()` в layout. Не-авторизованный → редирект на `/login`. Пользователь без роли (`role = 'user'`) → блокирующий экран.

#### FR-9. Список чатов (`/`)
- Лента активных и недавних чатов: `clients` JOIN последнее `messages`.
- Бейджи: эскалация (`escalated` / `manager_active`), назначенный менеджер, теги, число непрочитанных от клиента.
- Realtime-обновление при новом сообщении или смене `escalation_status` (Supabase Realtime по `messages` и `clients`).

#### FR-10. Чат с клиентом (`/chat/[id]`)
- История `messages` (`client | bot | manager | note`):
  - `client` — слева;
  - `bot` — слева, помеченный AI-моделью;
  - `manager` — справа, с именем менеджера;
  - `note` — выделенный «жёлтый стикер», виден только в админке.
- `ChatAssignBar` — выбор/смена/снятие назначенного менеджера.
- `ReplyForm`:
  - Поле ввода → отправка через `admin-reply` (текст).
  - `RecipePicker` (поиск по `recipes`) → отправка готового рецепта (передаётся `recipeId`, текст подставляется на стороне edge-функции).
  - Внутренняя заметка (`note`) — пишется в `messages` без отправки в Telegram.
- `ReturnToBotButton` — `escalation_status = 'normal'`.
- `ClientTagsEditor` — редактирование `clients.tags` (text[]).
- `ChatSettings` — model/temperature/max_tokens/system_prompt per client (`chat_settings`).
- Realtime-подписка на `messages`, фильтр `client_id = eq.<id>`.
- **Звуковое уведомление** при новом сообщении от клиента в эскалации.

#### FR-11. История (`/history`)
- Таблица закрытых / неактивных чатов.
- Фильтры: по менеджеру, по тегу, по периоду.
- CSV-экспорт чата: `GET /api/export/[id]` (только авторизованным).

#### FR-12. Recipes (`/recipes`)
- CRUD рецептов вручную.
- При создании — POST в edge-функцию `add-recipe` для подсчёта эмбеддинга (1024-d) и сохранения.
- Поиск/фильтрация по title (FTS) и категории.

#### FR-13. Stats (`/stats`)
- Метрики менеджера: число обработанных эскалаций, среднее время ответа, число отправленных рецептов.
- Метрики бота: общее число запросов, % эскалаций, top-N рецептов по оценкам.

#### FR-14. Admin (`/admin`) — только role='admin'
- Список менеджеров (`managers`) с возможностью смены роли (`user | manager | admin`).
- Удаление производится через Dashboard (вне scope админ-панели).

#### FR-15. Dashboard (`/dashboard`)
- Сводка: эскалации в очереди, активные диалоги менеджеров, новые рецепты за сутки.

### 4.3 Edge Functions

#### FR-16. `telegram-webhook`
Принимает Telegram updates (`POST`). Обработка описана в FR-1…FR-7. Всегда возвращает `200 OK` (даже на ошибки) — Telegram иначе делает ретраи.

#### FR-17. `admin-reply`
- Аутентификация: `Authorization: Bearer <user JWT>` → `auth.getUser()`.
- Валидация: `manager.user_id == auth.user.id`, `assignment.assigned_manager_id == managerId`.
- Если передан `recipeId` — текст подставляется из `recipes.description`, к сообщению прикрепляется recipe-keyboard.
- При `escalation_status = 'escalated'` → `manager_active` + системное сообщение клиенту.
- Insert в `messages` (`sender_type='manager'`, `manager_id`, `recipe_id`).
- Отправка в Telegram через `sendMessage`.
- Ответ: `200 { ok: true }` или `4xx` с описанием.

#### FR-18. `add-recipe`
- Принимает рецепт (title, description, ingredients, instructions, category).
- Считает эмбеддинг (Jina, режим `passage`).
- Insert в `recipes`.

---

## 5. Нефункциональные требования

| ID | Требование |
| --- | --- |
| NFR-1 | **Идемпотентность** webhook'а: дубль `telegram_message_id` → молча 200. |
| NFR-2 | **Latency**: ответ бота на запрос рецепта ≤ 6 сек p95 (DeepSeek + Jina). |
| NFR-3 | **Доступность**: edge-функции — Supabase Functions (auto-scale). Админка — Vercel/любой Node hosting. |
| NFR-4 | **Realtime**: задержка обновления UI при новом сообщении ≤ 1 сек. |
| NFR-5 | **Безопасность**: secrets (DeepSeek API key, Telegram token, Service Role) — только в env edge-функций. Никогда в репо или клиентском бандле. |
| NFR-6 | **RLS**: на всех публичных таблицах. Доступ `anon` запрещён везде. Все политики проходят через `get_my_role()`. |
| NFR-7 | **Аудит**: все изменения assignment'ов пишутся в `messages_managers` (`assigned`/`unassigned`). |
| NFR-8 | **i18n**: интерфейс — русский. Тексты бота — русский. Code/comments — английский. |
| NFR-9 | **Соответствие FSD**: `support-admin` следует Feature-Sliced Design (`app → widgets → features → entities → shared`). Импорты — только сверху вниз. |
| NFR-10 | **Браузерная совместимость**: Chrome/Edge/Firefox последние 2 версии, Safari 16+. |
| NFR-11 | **Bundle size** админки: < 500 KB gzipped initial JS. |
| NFR-12 | **Логи**: edge-функции логируют ошибки в `console.error`, успешные операции — кратко в `console.log`. |
| NFR-13 | **Версионность миграций**: timestamp-based (`YYYYMMDDhhmmss_*.sql`), forward-only, без rollback'ов. |

---

## 6. Архитектура

### 6.1 Стек

| Слой | Технология |
| --- | --- |
| Bot runtime | Supabase Edge Functions (Deno) |
| Database | Supabase Postgres + `pgvector` |
| Realtime | Supabase Realtime (logical replication) |
| Auth | Supabase Auth (Google OAuth) |
| Admin frontend | Next.js 16 (App Router, React 19, Server Actions) |
| Styling | Tailwind CSS v4 |
| Architecture | Feature-Sliced Design |
| LLM | DeepSeek (`deepseek-v4-flash` / `deepseek-v4-pro`) |
| Embeddings | Jina BGE-M3 (1024-d) |
| Telegram | Bot API (long-polling выключен, используется webhook) |
| Package manager | pnpm (workspace) |

### 6.2 Структура репозитория

```
vibecoding/
├── docs/                          # C4, ERD, sequence-диаграммы, ТЗ
├── supabase/
│   ├── config.toml
│   ├── migrations/                # timestamp-based SQL миграции
│   └── functions/
│       ├── _shared/               # api/ lib/ types/ embeddings.ts database.types.ts
│       ├── telegram-webhook/      # _handlers/ _lib/ index.ts
│       ├── admin-reply/
│       └── add-recipe/
└── support-admin/                 # Next.js админка (FSD)
    └── src/
        ├── app/                   # routes (App Router)
        ├── widgets/               # chat-list, messages-list, recipe-list
        ├── features/              # assign-manager, chat-reply, escalation,
        │                          # client-tags, recipe-management,
        │                          # recipe-picker, user-management, auth,
        │                          # chat-settings
        ├── entities/              # client, manager, message, recipe
        └── shared/                # api/ lib/ types/ ui/
```

### 6.3 Диаграммы
См. `docs/`:
- `c4-context.puml`, `c4-container.puml`, `c4-component.puml`, `c4-code.puml` — C4-модель.
- `erd.puml` — схема БД.
- `seq-incoming-message.puml` — обработка сообщения от клиента.
- `seq-assign-manager.puml` — назначение менеджера и ответ через `admin-reply`.

---

## 7. Модель данных

> Полная схема в `docs/erd.puml`. Здесь — ключевые таблицы.

### 7.1 `managers`
| Колонка | Тип | Примечание |
|---|---|---|
| `id` | bigint PK | |
| `user_id` | uuid | FK на `auth.users` |
| `name` | text | |
| `position` | text | |
| `role` | text | `admin | manager | user`, default `manager` |
| `created_at` | timestamptz | |

### 7.2 `clients`
| Колонка | Тип | Примечание |
|---|---|---|
| `id` | bigint PK | |
| `chat_id` | bigint | UNIQUE, Telegram chat_id |
| `user_id`, `username`, `first_name`, `last_name` | | Telegram user data |
| `status` | text | `open | closed` |
| `escalation_status` | text | `normal | escalated | manager_active` |
| `escalated_at` | timestamptz | момент эскалации |
| `setup_state` | text | многошаговые флоу (`awaiting_preferences`) |
| `tags` | text[] | произвольные метки |

### 7.3 `messages`
| Колонка | Тип | Примечание |
|---|---|---|
| `id` | bigint PK | |
| `client_id` | bigint FK | |
| `manager_id` | bigint FK nullable | для `sender_type in ('manager', 'note')` |
| `recipe_id` | bigint FK nullable | для бот/менеджер-сообщений с рецептом |
| `sender_type` | text | `client | bot | manager | note` |
| `text` | text | |
| `telegram_message_id` | bigint | UNIQUE partial (where not null) — идемпотентность |
| `prompt_tokens`, `completion_tokens`, `total_tokens` | int nullable | для бот-сообщений |
| `created_at` | timestamptz | |

### 7.4 `recipes`
| Колонка | Тип | Примечание |
|---|---|---|
| `id` | bigint PK | |
| `title` | varchar(256) | UNIQUE по нормализованной форме |
| `description`, `ingredients`, `instructions` | text | |
| `category` | text | |
| `embedding` | vector(1024) | BGE-M3 |
| `created_at` | timestamptz | |

### 7.5 Прочее
- `client_assignments(client_id UNIQUE, assigned_manager_id, assigned_by_manager_id, updated_at)` — текущая привязка.
- `messages_managers(client_id, manager_id, action, created_at)` — аудит назначений.
- `chat_settings(client_id PK, model, temperature, max_tokens, system_prompt)`.
- `client_preferences(client_id PK, dietary_notes, created_at, updated_at)`.
- `recipe_ratings(client_id, recipe_id, rating in (1,-1))` — UNIQUE по паре.
- `client_favorite_recipes(client_id, recipe_id, title, saved_at)` — UNIQUE по паре.

### 7.6 Функции
- `get_my_role() → text` — `SECURITY DEFINER`, читает `managers.role` для `auth.uid()`.
- `search_recipes(query_embedding vector(1024), query_text text DEFAULT '', match_count int DEFAULT 10)` — гибрид: cosine similarity ≥ 0.7 + FTS по `title` (russian).

### 7.7 RLS — обзор
- На всех таблицах включён `enable row level security`.
- Чтение `recipes` — все `authenticated`. Запись — `admin|manager`.
- `managers`: SELECT — собственная строка ИЛИ `admin|manager`. UPDATE — только `admin`.
- `clients`, `messages`, `client_assignments`, `chat_settings`, `messages_managers`, `client_preferences`, `recipe_ratings`, `client_favorite_recipes` — `admin|manager` через `get_my_role()`.

### 7.8 Realtime publication
- `supabase_realtime` включает `messages` и `clients` для UI-подписок.

---

## 8. Внешние интеграции

### 8.1 Telegram Bot API
- Webhook URL: `https://<project>.supabase.co/functions/v1/telegram-webhook`.
- Используются методы: `sendMessage`, `sendChatAction`, `answerCallbackQuery`.
- Все исходящие сообщения проходят через `_shared/api/telegram.ts`.
- Markdown-форматирование — **запрещено** в системном промпте; на выходе LLM текст дополнительно очищается `stripMarkdown`.

### 8.2 DeepSeek
- Endpoint: OpenAI-совместимый (`/v1/chat/completions`).
- Модели: `deepseek-v4-flash` (default), `deepseek-v4-pro` (per-client override через `chat_settings.model`).
- Формат ответа — **structured JSON**:
  ```json
  {
    "can_help": true,
    "need_clarification": false,
    "options": [],
    "question": "",
    "title": "...",
    "category": "...",
    "ingredients": "...",
    "instructions": "...",
    "reply_text": "..."
  }
  ```
- Default настройки: `temperature=0.8`, `max_tokens=10000`.

### 8.3 Jina Embeddings
- Endpoint: `https://api.jina.ai/v1/embeddings`.
- Модель: `jina-embeddings-v3` BGE-M3 совместимая, размерность **1024**.
- Два режима: `query` (для поискового запроса) и `passage` (для индексации рецепта).

### 8.4 Google OAuth
- Через Supabase Auth Provider.
- Domain whitelist опционально — настраивается в Supabase Dashboard.

---

## 9. Безопасность

| Угроза | Контрмера |
| --- | --- |
| Несанкционированный доступ в админку | Google OAuth + RLS + проверка роли в layout. |
| Manager A отвечает за клиента manager B | `admin-reply` проверяет совпадение `assignment.assigned_manager_id == managerId` и `manager.user_id == auth.user.id`. |
| Service-role-ключ в браузере | `service_role` используется **только** в edge-функциях. В админке — `anon` + сессия пользователя. |
| Двойная обработка Telegram update | UNIQUE индекс `messages_telegram_message_id_unique` + молчаливый 200 при `23505`. |
| Спам / DoS от клиента | Rate-limit 20 сообщений/час на `client_id`. |
| Prompt injection в LLM | System prompt запрещает выход за кулинарную тему, structured-output убирает свободу формата. |
| Утечка персональных данных | `auth.users` доступна только через `SECURITY DEFINER`-функции. RLS закрывает прямой доступ. |
| Отзыв доступа уволенного менеджера | Смена `role='user'` через `/admin` или Supabase Dashboard — мгновенно блокирует доступ через RLS. |

---

## 10. Развёртывание

### 10.1 Окружения
- **Production**: единственное Supabase-проект, единственный Telegram-бот.
- Локальная разработка: `supabase start`, `supabase functions serve <name>`, `pnpm --filter support-admin dev`.

### 10.2 Конфигурация (env)
- **Edge Functions**: `TELEGRAM_BOT_TOKEN`, `DEEPSEEK_API_KEY`, `JINA_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Admin**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_FUNCTIONS_URL`.

### 10.3 Чек-лист релиза
1. Прогнать миграции: `supabase db push`.
2. Задеплоить edge-функции: `supabase functions deploy telegram-webhook admin-reply add-recipe`.
3. Проверить webhook в Telegram: `setWebhook`.
4. Задеплоить админку (Vercel / Cloudflare Pages).
5. Smoke-тест: сообщение боту → ответ; назначить менеджера → ответ через админку.

---

## 11. Этапы работ (для нового проекта с нуля)

> Если делать ChefBot заново, разбить на 8 спринтов по ~1 неделе.

| Спринт | Скоуп | Артефакты |
|---|---|---|
| **S1. Foundation** | Supabase проект, Auth (Google), базовые миграции (`managers`, `clients`, `messages`), RLS-helper `get_my_role()`. | Login + пустой layout админки. |
| **S2. Bot MVP** | `telegram-webhook` MVP: upsert client, save message, simple LLM reply. Telegram webhook live. | Бот отвечает в продакшне. |
| **S3. Admin chats** | `entities/client`, `entities/message`, `widgets/chat-list`, `widgets/messages-list`, страница `/chat/[id]`. Realtime по `messages`. | Менеджер видит чаты в реальном времени. |
| **S4. Recipes & embeddings** | `recipes` + pgvector, Jina-эмбеддинги, `search_recipes` RPC, `add-recipe` edge-функция, страница `/recipes`. | Семантический поиск работает. |
| **S5. Recipe-flow & callbacks** | `recipe-flow.ts`: semantic ≥ 0.88 → fallback LLM, structured output, recipe/clarify-keyboards, `recipe_ratings`, `client_favorite_recipes`. | Полноценная подача рецептов. |
| **S6. Escalation** | `escalation_status`, `admin-reply` edge-функция, `assign-manager`, `chat-reply`, `escalation` features, аудит `messages_managers`. | Эскалация бот↔менеджер↔бот. |
| **S7. UX polish** | Команды `/preferences`, `/save`, `/saved`, `/list`, `/random`, `/week`. Reply-keyboard. Rate-limit. Casual-detection. Idempotency. | Финальный продуктовый функционал бота. |
| **S8. Admin polish** | `/history` + CSV-экспорт, `/stats`, `/admin` (роли), `client-tags`, `chat-settings`, заметки (`note`), recipe-picker, звуковые алерты. | Готов к передаче в эксплуатацию. |

---

## 12. Критерии приёмки

- [ ] Все миграции применяются на чистой БД без ошибок.
- [ ] Прохождение smoke-теста (см. §10.3).
- [ ] Лог не содержит `Error` при штатных сценариях из §4.
- [ ] RLS-политики проходят: `anon` не может читать `clients`/`messages`; `user` (без роли) не видит чаты; manager A не может ответить за клиента manager B.
- [ ] При повторе Telegram update'а сообщение не дублируется.
- [ ] Realtime-уведомление приходит в админку < 1 сек после INSERT.
- [ ] Эскалация: `escalated → manager_active → normal` работает в обе стороны.
- [ ] CSV-экспорт корректно отдаёт историю чата для авторизованного менеджера.

---

## 13. Открытые вопросы / риски

1. **Стоимость DeepSeek + Jina** при росте трафика — не оценена. Мониторинг через `messages.total_tokens`.
2. **Дедупликация рецептов**: текущая стратегия — UNIQUE на нормализованный title. Возможны коллизии для разных вариантов одного блюда.
3. **Holiday/peak load**: rate-limit 20/час может оказаться слишком строгим/мягким — требует данных эксплуатации.
4. **Multi-tenancy**: текущая схема предполагает одного бота / одну компанию. Для масштабирования потребуется добавить `tenant_id` ко всем таблицам.
5. **Уведомления менеджеров вне админки** (push / email при эскалации) — пока не реализовано.
