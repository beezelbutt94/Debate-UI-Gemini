"""Tests for app.workers.webhooks –
assert_safe_webhook_url, generate_signature, deliver_with_retries.
"""
import hashlib
import hmac
import json
import os
import sys
import time
from unittest.mock import MagicMock, patch

import pytest

# Ensure the services/api directory is on sys.path
_API_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.workers.webhooks import (
    UnsafeWebhookTarget,
    assert_safe_webhook_url,
    generate_signature,
    deliver_with_retries,
)


# ---------------------------------------------------------------------------
# generate_signature
# ---------------------------------------------------------------------------

class TestGenerateSignature:
    def test_returns_hex_string(self):
        sig = generate_signature("secret", b"payload")
        assert all(c in "0123456789abcdef" for c in sig)

    def test_correct_hmac_sha256(self):
        secret = "mysecret"
        payload = b'{"event":"test"}'
        expected = hmac.new(
            secret.encode("utf-8"), payload, hashlib.sha256
        ).hexdigest()
        assert generate_signature(secret, payload) == expected

    def test_different_secrets_produce_different_signatures(self):
        payload = b"same payload"
        sig1 = generate_signature("secret1", payload)
        sig2 = generate_signature("secret2", payload)
        assert sig1 != sig2

    def test_different_payloads_produce_different_signatures(self):
        secret = "same_secret"
        sig1 = generate_signature(secret, b"payload_a")
        sig2 = generate_signature(secret, b"payload_b")
        assert sig1 != sig2

    def test_deterministic(self):
        s1 = generate_signature("s", b"p")
        s2 = generate_signature("s", b"p")
        assert s1 == s2

    def test_empty_payload(self):
        sig = generate_signature("key", b"")
        assert len(sig) == 64  # SHA-256 hex digest is 64 chars

    def test_empty_secret(self):
        sig = generate_signature("", b"data")
        assert isinstance(sig, str)
        assert len(sig) == 64

    def test_unicode_heavy_secret(self):
        sig = generate_signature("🔑secret", b"data")
        assert len(sig) == 64

    def test_large_payload(self):
        payload = b"x" * 1_000_000
        sig = generate_signature("key", payload)
        assert len(sig) == 64


# ---------------------------------------------------------------------------
# assert_safe_webhook_url
# ---------------------------------------------------------------------------

class TestAssertSafeWebhookUrl:
    def test_rejects_ftp_scheme(self):
        with pytest.raises(UnsafeWebhookTarget, match="scheme"):
            assert_safe_webhook_url("ftp://example.com/hook")

    def test_rejects_missing_scheme(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("://no-scheme.com")

    def test_rejects_loopback_127(self):
        # We mock getaddrinfo to return a loopback address
        import socket
        fake_addr = [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("127.0.0.1", 80))]
        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=fake_addr):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("http://internal.service/hook")

    def test_rejects_private_192_168(self):
        import socket
        fake_addr = [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("192.168.1.5", 443))]
        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=fake_addr):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("https://private.host/hook")

    def test_rejects_link_local_169_254(self):
        import socket
        # 169.254.169.254 is the AWS metadata endpoint
        fake_addr = [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("169.254.169.254", 80))]
        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=fake_addr):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("http://metadata/hook")

    def test_rejects_private_10_x(self):
        import socket
        fake_addr = [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("10.0.0.1", 80))]
        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=fake_addr):
            with pytest.raises(UnsafeWebhookTarget):
                assert_safe_webhook_url("http://internal/hook")

    def test_accepts_public_ip(self):
        import socket
        fake_addr = [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("93.184.216.34", 443))]
        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=fake_addr):
            # Should not raise
            assert_safe_webhook_url("https://example.com/hook")

    def test_raises_on_dns_failure(self):
        import socket
        with patch("app.workers.webhooks.socket.getaddrinfo", side_effect=socket.gaierror("NX")):
            with pytest.raises(UnsafeWebhookTarget, match="could not resolve"):
                assert_safe_webhook_url("https://nonexistent.invalid/hook")

    def test_rejects_http_no_hostname(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("http:///path")

    def test_rejects_file_scheme(self):
        with pytest.raises(UnsafeWebhookTarget, match="scheme"):
            assert_safe_webhook_url("file:///etc/passwd")


# ---------------------------------------------------------------------------
# deliver_with_retries
# ---------------------------------------------------------------------------

class TestDeliverWithRetries:
    """Tests that do not make real network calls."""

    def _public_addr(self):
        import socket
        return [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("93.184.216.34", 443))]

    def test_returns_true_on_200(self):
        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=self._public_addr()):
            with patch("app.workers.webhooks.requests.post", return_value=mock_response):
                result = deliver_with_retries(
                    "https://example.com/hook", "secret", "video.completed", {"id": "1"}
                )
        assert result is True

    def test_returns_true_on_201(self):
        mock_response = MagicMock()
        mock_response.status_code = 201

        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=self._public_addr()):
            with patch("app.workers.webhooks.requests.post", return_value=mock_response):
                result = deliver_with_retries(
                    "https://example.com/hook", "secret", "evt", {}
                )
        assert result is True

    def test_returns_false_when_unsafe_target(self):
        import socket
        private_addr = [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("127.0.0.1", 80))]
        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=private_addr):
            result = deliver_with_retries(
                "http://localhost/hook", "secret", "evt", {}
            )
        assert result is False

    def test_returns_false_after_all_retries_fail(self):
        import requests as req

        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=self._public_addr()):
            with patch("app.workers.webhooks.requests.post", side_effect=req.RequestException("timeout")):
                with patch("app.workers.webhooks.time.sleep"):
                    result = deliver_with_retries(
                        "https://example.com/hook", "secret", "evt", {}
                    )
        assert result is False

    def test_returns_false_on_500_status(self):
        mock_response = MagicMock()
        mock_response.status_code = 500

        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=self._public_addr()):
            with patch("app.workers.webhooks.requests.post", return_value=mock_response):
                with patch("app.workers.webhooks.time.sleep"):
                    result = deliver_with_retries(
                        "https://example.com/hook", "secret", "evt", {}
                    )
        assert result is False

    def test_signature_header_sent(self):
        """Verifies the X-Signature-256 header is computed and forwarded."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        captured = {}

        def fake_post(url, data, headers, timeout, allow_redirects):
            captured["headers"] = headers
            captured["data"] = data
            return mock_response

        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=self._public_addr()):
            with patch("app.workers.webhooks.requests.post", side_effect=fake_post):
                deliver_with_retries("https://example.com/hook", "mysecret", "e", {})

        assert "X-Signature-256" in captured["headers"]
        sig = captured["headers"]["X-Signature-256"]
        expected = hmac.new("mysecret".encode(), captured["data"], hashlib.sha256).hexdigest()
        assert sig == expected

    def test_event_header_sent(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        captured = {}

        def fake_post(url, data, headers, timeout, allow_redirects):
            captured["headers"] = headers
            return mock_response

        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=self._public_addr()):
            with patch("app.workers.webhooks.requests.post", side_effect=fake_post):
                deliver_with_retries("https://example.com/hook", "s", "video.started", {})

        assert captured["headers"]["X-ViralVision-Event"] == "video.started"

    def test_no_redirects_allowed(self):
        """allow_redirects=False must be passed to prevent redirect-based SSRF."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        captured = {}

        def fake_post(url, data, headers, timeout, allow_redirects):
            captured["allow_redirects"] = allow_redirects
            return mock_response

        with patch("app.workers.webhooks.socket.getaddrinfo", return_value=self._public_addr()):
            with patch("app.workers.webhooks.requests.post", side_effect=fake_post):
                deliver_with_retries("https://example.com/hook", "s", "e", {})

        assert captured["allow_redirects"] is False
