import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import worker


class ClerkIdentityMigrationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.env = SimpleNamespace(
            DATABASE_URL="postgresql://example/db",
            MODO_LOCAL="0",
        )
        self.clerk_user = {
            "user_id": "user_clerk_123",
            "clerk_user_id": "user_clerk_123",
            "username": "user_clerk_123",
            "display_name": "Ana",
        }
        self.legacy_user = {
            "user_id": "local:ana",
            "username": "ana",
            "display_name": "Ana Legacy",
            "password_hash": worker._hash_pw("old-password"),
            "clerk_user_id": None,
        }

    async def test_linking_legacy_account_preserves_internal_user_id(self):
        with patch.object(
            worker,
            "neon_sql",
            new=AsyncMock(side_effect=[
                [self.legacy_user],
                [],
                [{"user_id": "local:ana"}],
            ]),
        ) as sql:
            linked = await worker.link_legacy_account(
                self.env, self.clerk_user, "ana", "old-password"
            )

        self.assertEqual(linked["user_id"], "local:ana")
        self.assertEqual(linked["clerk_user_id"], "user_clerk_123")
        self.assertEqual(sql.await_count, 3)

    async def test_linking_legacy_account_rejects_wrong_password(self):
        with patch.object(
            worker, "neon_sql", new=AsyncMock(return_value=[self.legacy_user])
        ) as sql:
            with self.assertRaises(HTTPException) as raised:
                await worker.link_legacy_account(
                    self.env, self.clerk_user, "ana", "wrong-password"
                )

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(sql.await_count, 1)

    async def test_linking_legacy_account_rejects_clerk_identity_linked_elsewhere(self):
        with patch.object(
            worker,
            "neon_sql",
            new=AsyncMock(side_effect=[
                [self.legacy_user],
                [{"user_id": "local:other"}],
            ]),
        ) as sql:
            with self.assertRaises(HTTPException) as raised:
                await worker.link_legacy_account(
                    self.env, self.clerk_user, "ana", "old-password"
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(sql.await_count, 2)

    async def test_existing_clerk_mapping_restores_legacy_user_id(self):
        mapped_user = {
            "user_id": "local:ana",
            "username": "ana",
            "display_name": "Ana Legacy",
        }
        with patch.object(
            worker, "neon_sql", new=AsyncMock(return_value=[mapped_user])
        ):
            await worker.ensure_user_in_db(self.env, self.clerk_user)

        self.assertEqual(self.clerk_user["user_id"], "local:ana")
        self.assertEqual(self.clerk_user["username"], "ana")


if __name__ == "__main__":
    unittest.main()
