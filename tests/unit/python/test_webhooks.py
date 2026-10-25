"""Tests for services/api/app/workers/webhooks — pure utility functions.

The module imports SQLAlchemy models which connect to Postgres at import
time. We stub the problematic modules before importing so we can test the
pure functions (generate_signature, assert_safe_webhook_url) without a
database.
"""
import sys
import os
import hashlib
import hmac
from unittest.mock import MagicMock, patch

# Resolve services/api onto sys.path so `app.*` imports work.
_SERVICES_API = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api')
sys.path.insert(0, _SERVICES_API)

# Stub heavy/env-bound modules before importing `webhooks` so nothing
# tries to open a database connection.
_stubs = {
    'app.core.database': MagicMock(),
    'app.core.models': MagicMock(),
}
for _name, _stub in _stubs.items():
    sys.modules.setdefault(_name, _stub)

import pytest
from app.workers.webhooks import (
    generate_signature,
    assert_safe_webhook_url,
    UnsafeWebhookTarget,
)


class TestGenerateSignature:
    def test_returns_hex_string(self):
        result = generate_signature("secret", b"payload")
        assert all(c in "0123456789abcdef" for c in result)

    def test_deterministic(self):
        sig1 = generate_signature("secret", b"payload")
        sig2 = generate_signature("secret", b"payload")
        assert sig1 == sig2

    def test_different_secrets_produce_different_signatures(self):
        sig1 = generate_signature("secret1", b"payload")
        sig2 = generate_signature("secret2", b"payload")
        assert sig1 != sig2

    def test_different_payloads_produce_different_signatures(self):
        sig1 = generate_signature("secret", b"payload1")
        sig2 = generate_signature("secret", b"payload2")
        assert sig1 != sig2

    def test_matches_hmac_sha256_reference(self):
        secret = "my_webhook_secret"
        payload = b'{"event":"video.completed"}'
        expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        assert generate_signature(secret, payload) == expected

    def test_empty_payload(self):
        result = generate_signature("secret", b"")
        expected = hmac.new(b"secret", b"", hashlib.sha256).hexdigest()
        assert result == expected

    def test_empty_secret(self):
        result = generate_signature("", b"payload")
        expected = hmac.new(b"", b"payload", hashlib.sha256).hexdigest()
        assert result == expected

    def test_unicode_secret(self):
        result = generate_signature("sécret", b"data")
        expected = hmac.new("sécret".encode("utf-8"), b"data", hashlib.sha256).hexdigest()
        assert result == expected

    def test_long_payload(self):
        payload = b"x" * 100_000
        result = generate_signature("secret", payload)
        assert len(result) == 64  # SHA-256 hex = 64 chars

    def test_output_is_64_chars(self):
        assert len(generate_signature("secret", b"payload")) == 64


# ---------------------------------------------------------------------------
# assert_safe_webhook_url
# ---------------------------------------------------------------------------

def _make_getaddrinfo(ip: str):
    """Return a mock getaddrinfo that resolves to the given IP."""
    return lambda host, port: [(None, None, None, None, (ip, port))]


class TestAssertSafeWebhookUrl:
    # ---- scheme checks --------------------------------------------------------
    def test_rejects_ftp_scheme(self):
        with pytest.raises(UnsafeWebhookTarget, match="unsupported scheme"):
            assert_safe_webhook_url("ftp://example.com/hook")

    def test_rejects_file_scheme(self):
        with pytest.raises(UnsafeWebhookTarget, match="unsupported scheme"):
            assert_safe_webhook_url("file:///etc/passwd")

    def test_rejects_empty_hostname(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("https:///path")

    # ---- loopback / private network rejection ---------------------------------
    def test_rejects_loopback_127_0_0_1(self):
        with patch("app.workers.webhooks.socket.getaddrinfo", _make_getaddrinfo("127.0.0.1")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public address"):
                assert_safe_webhook_url("https://localhost/hook")

    def test_rejects_loopback_ipv6(self):
        with patch("app.workers.webhooks.socket.getaddrinfo", _make_getaddrinfo("::1")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public address"):
                assert_safe_webhook_url("https://localhost/hook")

    def test_rejects_private_10_x(self):
        with patch("app.workers.webhooks.socket.getaddrinfo", _make_getaddrinfo("10.0.0.1")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public address"):
                assert_safe_webhook_url("https://internal.corp/hook")

    def test_rejects_private_192_168(self):
        with patch("app.workers.webhooks.socket.getaddrinfo", _make_getaddrinfo("192.168.1.1")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public address"):
                assert_safe_webhook_url("https://router.local/hook")

    def test_rejects_private_172_16(self):
        with patch("app.workers.webhooks.socket.getaddrinfo", _make_getaddrinfo("172.16.0.5")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public address"):
                assert_safe_webhook_url("https://service.internal/hook")

    def test_rejects_link_local_metadata(self):
        # 169.254.169.254 = AWS/GCP metadata endpoint
        with patch("app.workers.webhooks.socket.getaddrinfo", _make_getaddrinfo("169.254.169.254")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public address"):
                assert_safe_webhook_url("https://metadata.internal/hook")

    # ---- public IP passes -----------------------------------------------------
    def test_allows_public_ip(self):
        with patch("app.workers.webhooks.socket.getaddrinfo", _make_getaddrinfo("93.184.216.34")):
            # Should not raise
            assert_safe_webhook_url("https://example.com/hook")

    def test_allows_https_public_url(self):
        with patch("app.workers.webhooks.socket.getaddrinfo", _make_getaddrinfo("1.2.3.4")):
            assert_safe_webhook_url("https://webhook.site/test")

    def test_allows_http_public_url(self):
        with patch("app.workers.webhooks.socket.getaddrinfo", _make_getaddrinfo("5.6.7.8")):
            assert_safe_webhook_url("http://webhook.site/test")

    # ---- DNS resolution failure -----------------------------------------------
    def test_rejects_unresolvable_hostname(self):
        import socket
        def failing_lookup(host, port):
            raise socket.gaierror("Name or service not known")

        with patch("app.workers.webhooks.socket.getaddrinfo", failing_lookup):
            with pytest.raises(UnsafeWebhookTarget, match="could not resolve"):
                assert_safe_webhook_url("https://nonexistent.invalid/hook")
