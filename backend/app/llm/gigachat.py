from __future__ import annotations

import uuid
from typing import Any

import httpx

from app.config import Settings


class GigaChatClient:
    """Клиент GigaChat. Без ключей возвращает mock."""

    AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    API_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"

    def __init__(self, settings: Settings):
        self.settings = settings
        self._token: str | None = None

    @property
    def ready(self) -> bool:
        return self.settings.gigachat_ready and self.settings.llm_mode == "live"

    async def complete(self, system: str, user: str) -> dict[str, Any]:
        if not self.ready:
            return {
                "provider": "gigachat",
                "mode": "mock",
                "content": self._mock(user),
            }

        # GigaChat часто лучше следует инструкции, если system вшит в user
        merged_user = (
            f"[СИСТЕМНАЯ ИНСТРУКЦИЯ]\n{system}\n\n"
            f"[ЗАПРОС ВРАЧА]\n{user}\n\n"
            "Важно: дай ПОЛНЫЙ содержательный ответ по разделам с маркированными списками фактов. "
            "Нельзя оставлять пустые разделы вида только «Минздрав РФ». "
            "Если live-источники в контексте скудные — всё равно дай полный клинический обзор "
            "по стандартным знаниям РФ-практики и явно пометь ограничение актуальности."
        )

        token = await self._get_token()
        try:
            content = await self._chat(token, merged_user)
        except httpx.HTTPStatusError as e:
            if e.response is not None and e.response.status_code in (401, 403):
                self._token = None
                token = await self._get_token()
                content = await self._chat(token, merged_user)
            else:
                raise

        return {"provider": "gigachat", "mode": "live", "content": content}

    async def _chat(self, token: str, user_content: str) -> str:
        async with httpx.AsyncClient(timeout=90, verify=False) as client:
            res = await client.post(
                self.API_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.settings.gigachat_model or "GigaChat",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Ты — Система Vitalis, медицинский ассистент. "
                                "Отвечай полно, структурировано, по-русски, списками фактов."
                            ),
                        },
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0.35,
                    "max_tokens": 3500,
                },
            )
            res.raise_for_status()
            data = res.json()
        return data["choices"][0]["message"]["content"]

    async def _get_token(self) -> str:
        if self._token:
            return self._token
        rquid = str(uuid.uuid4())
        async with httpx.AsyncClient(timeout=30, verify=False) as client:
            res = await client.post(
                self.AUTH_URL,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                    "RqUID": rquid,
                    "Authorization": self._basic_auth(),
                },
                data={"scope": self.settings.gigachat_scope},
            )
            res.raise_for_status()
            self._token = res.json()["access_token"]
            return self._token

    def _basic_auth(self) -> str:
        import base64

        secret = self.settings.gigachat_client_secret.strip()
        client_id = self.settings.gigachat_client_id.strip()
        if not client_id and secret:
            try:
                decoded = base64.b64decode(secret, validate=True).decode("utf-8")
                if ":" in decoded:
                    return "Basic " + secret
            except Exception:
                pass
        raw = f"{client_id}:{secret}"
        return "Basic " + base64.b64encode(raw.encode()).decode()

    @staticmethod
    def _mock(user: str) -> str:
        return (
            "## РФ-рекомендации (демо-режим)\n\n"
            f"Запрос: «{user[:200]}»\n\n"
            "### Диагностика\n"
            "- Демо-ответ. Добавьте ключи и LLM_MODE=live.\n\n"
            "Информация носит справочный характер. Решение принимает лечащий врач."
        )
