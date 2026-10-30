"""Tests for services/api/app/workers/webhooks.py

Covers: generate_signature, assert_safe_webhook_url (SSRF protection),
deliver_with_retries, dispatch_webhooks.
No real network calls are made — socket.getaddrinfo and requests.post are patched.
"""
import hashlib
import hmac
import json
from unittest.mock import MagicMock, call, patch

import pytest
import requests

# Make sure the services/api package is importable even without installing it
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))

from app.workers.webhooks import (
    RETRY_SCHEDULE_SECONDS,
    UnsafeWebhookTarget,
    assert_safe_webhook_url,
    deliver_with_retries,
    dispatch_webhooks,
    generate_signature,
)


# ── generate_signature ────────────────────────────────────────────────────────

class TestGenerateSignature:
    def test_returns_hex_string(self):
        sig = generate_signature("secret", b"payload")
        assert isinstance(sig, str)
        assert all(c in "0123456789abcdef" for c in sig)

    def test_correct_length_for_sha256(self):
        # HMAC-SHA256 → 32 bytes → 64 hex chars
        assert len(generate_signature("s", b"p")) == 64

    def test_deterministic(self):
        assert generate_signature("key", b"data") == generate_signature("key", b"data")

    def test_different_secrets_produce_different_sigs(self):
        s1 = generate_signature("secret1", b"payload")
        s2 = generate_signature("secret2", b"payload")
        assert s1 != s2

    def test_different_payloads_produce_different_sigs(self):
        s1 = generate_signature("key", b"payload-a")
        s2 = generate_signature("key", b"payload-b")
        assert s1 != s2

    def test_matches_stdlib_hmac(self):
        secret, payload = "my-secret", b'{"event":"video.completed"}'
        expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        assert generate_signature(secret, payload) == expected

    def test_empty_payload(self):
        sig = generate_signature("key", b"")
        assert len(sig) == 64

    def test_empty_secret(self):
        sig = generate_signature("", b"payload")
        assert len(sig) == 64

    def test_unicode_secret_encoded_as_utf8(self):
        # Ensure multi-byte chars don't cause a crash and still produce a valid sig
        sig = generate_signature("sécret-🔑", b"test")
        assert len(sig) == 64

    def test_large_payload(self):
        payload = b"x" * 100_000
        sig = generate_signature("key", payload)
        assert len(sig) == 64


# ── assert_safe_webhook_url ───────────────────────────────────────────────────

def _mock_getaddrinfo(ip: str):
    """Returns a getaddrinfo patcher that yields a single IPv4 result."""
    return patch(
        "app.workers.webhooks.socket.getaddrinfo",
        return_value=[(2, 1, 6, "", (ip, 443))],
    )


class TestAssertSafeWebhookUrl:
    # ── Valid public targets ─────────────────────────────────────────────────
    def test_public_ip_passes(self):
        with _mock_getaddrinfo("93.184.216.34"):  # example.com
            assert_safe_webhook_url("https://example.com/hook")  # must not raise

    def test_public_ip_http_passes(self):
        with _mock_getaddrinfo("93.184.216.34"):
            assert_safe_webhook_url("http://example.com/hook")

    # ── Loopback ────────────────────────────────────────────────────────────
    def test_loopback_127_0_0_1_rejected(self):
        with _mock_getaddrinfo("127.0.0.1"):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("https://localhost/hook")

    def test_loopback_127_0_0_2_rejected(self):
        with _mock_getaddrinfo("127.0.0.2"):
            with pytest.raises(UnsafeWebhookTarget):
                assert_safe_webhook_url("https://internal/hook")

    # ── Private ranges ───────────────────────────────────────────────────────
    def test_private_10_x_rejected(self):
        with _mock_getaddrinfo("10.0.0.1"):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("https://internal.corp/hook")

    def test_private_172_16_x_rejected(self):
        with _mock_getaddrinfo("172.16.0.1"):
            with pytest.raises(UnsafeWebhookTarget):
                assert_safe_webhook_url("https://internal2.corp/hook")

    def test_private_192_168_x_rejected(self):
        with _mock_getaddrinfo("192.168.1.1"):
            with pytest.raises(UnsafeWebhookTarget):
                assert_safe_webhook_url("https://router.local/hook")

    # ── Cloud metadata (link-local) ───────────────────────────────────────────
    def test_link_local_169_254_rejected(self):
        with _mock_getaddrinfo("169.254.169.254"):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("https://metadata.internal/latest")

    # ── Unsupported schemes ──────────────────────────────────────────────────
    def test_file_scheme_rejected(self):
        with pytest.raises(UnsafeWebhookTarget, match="scheme"):
            assert_safe_webhook_url("file:///etc/passwd")

    def test_ftp_scheme_rejected(self):
        with pytest.raises(UnsafeWebhookTarget, match="scheme"):
            assert_safe_webhook_url("ftp://example.com/hook")

    def test_empty_scheme_rejected(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("not-a-url")

    # ── Unresolvable hostname ─────────────────────────────────────────────────
    def test_unresolvable_hostname_rejected(self):
        import socket
        with patch("app.workers.webhooks.socket.getaddrinfo", side_effect=socket.gaierror("NXDOMAIN")):
            with pytest.raises(UnsafeWebhookTarget, match="could not resolve"):
                assert_safe_webhook_url("https://does-not-exist.example/hook")

    # ── Missing hostname ─────────────────────────────────────────────────────
    def test_no_hostname_rejected(self):
        with pytest.raises(UnsafeWebhookTarget, match="no hostname"):
            assert_safe_webhook_url("https:///path")


# ── deliver_with_retries ──────────────────────────────────────────────────────

def _ok_response(status_code: int = 200) -> MagicMock:
    r = MagicMock()
    r.status_code = status_code
    return r


class TestDeliverWithRetries:
    def test_returns_false_for_unsafe_url(self):
        with patch(
            "app.workers.webhooks.socket.getaddrinfo",
            return_value=[(2, 1, 6, "", ("127.0.0.1", 443))],
        ):
            result = deliver_with_retries("https://localhost/hook", "secret", "ev", {})
        assert result is False

    def test_returns_true_on_200(self):
        with patch("app.workers.webhooks.assert_safe_webhook_url"):
            with patch("app.workers.webhooks.requests.post", return_value=_ok_response(200)):
                assert deliver_with_retries("https://example.com/hook", "s", "ev", {}) is True

    def test_returns_true_on_201(self):
        with patch("app.workers.webhooks.assert_safe_webhook_url"):
            with patch("app.workers.webhooks.requests.post", return_value=_ok_response(201)):
                assert deliver_with_retries("https://example.com/hook", "s", "ev", {}) is True

    def test_returns_false_when_all_attempts_give_500(self):
        with patch("app.workers.webhooks.assert_safe_webhook_url"):
            with patch("app.workers.webhooks.requests.post", return_value=_ok_response(500)):
                with patch("app.workers.webhooks.time.sleep"):
                    assert deliver_with_retries("https://example.com/hook", "s", "ev", {}) is False

    def test_returns_true_after_one_retry(self):
        responses = [_ok_response(503), _ok_response(200)]
        with patch("app.workers.webhooks.assert_safe_webhook_url"):
            with patch("app.workers.webhooks.requests.post", side_effect=responses):
                with patch("app.workers.webhooks.time.sleep"):
                    assert deliver_with_retries("https://example.com/hook", "s", "ev", {}) is True

    def test_returns_false_when_request_exception_on_every_attempt(self):
        with patch("app.workers.webhooks.assert_safe_webhook_url"):
            with patch(
                "app.workers.webhooks.requests.post",
                side_effect=requests.RequestException("refused"),
            ):
                with patch("app.workers.webhooks.time.sleep"):
                    assert deliver_with_retries("https://example.com/hook", "s", "ev", {}) is False

    def test_attempt_count_equals_retry_schedule_length(self):
        mock_post = MagicMock(return_value=_ok_response(500))
        with patch("app.workers.webhooks.assert_safe_webhook_url"):
            with patch("app.workers.webhooks.requests.post", mock_post):
                with patch("app.workers.webhooks.time.sleep"):
                    deliver_with_retries("https://example.com/hook", "s", "ev", {})
        assert mock_post.call_count == len(RETRY_SCHEDULE_SECONDS)

    def test_allow_redirects_is_false(self):
        mock_post = MagicMock(return_value=_ok_response(200))
        with patch("app.workers.webhooks.assert_safe_webhook_url"):
            with patch("app.workers.webhooks.requests.post", mock_post):
                deliver_with_retries("https://example.com/hook", "s", "ev", {})
        _args, kwargs = mock_post.call_args
        assert kwargs.get("allow_redirects") is False

    def test_payload_includes_event_and_data(self):
        mock_post = MagicMock(return_value=_ok_response(200))
        with patch("app.workers.webhooks.assert_safe_webhook_url"):
            with patch("app.workers.webhooks.requests.post", mock_post):
                deliver_with_retries("https://example.com/hook", "s", "video.done", {"id": "v1"})
        _args, kwargs = mock_post.call_args
        body = json.loads(kwargs["data"])
        assert body["event"] == "video.done"
        assert body["data"] == {"id": "v1"}

    def test_x_signature_header_present(self):
        mock_post = MagicMock(return_value=_ok_response(200))
        with patch("app.workers.webhooks.assert_safe_webhook_url"):
            with patch("app.workers.webhooks.requests.post", mock_post):
                deliver_with_retries("https://example.com/hook", "mysecret", "ev", {})
        _args, kwargs = mock_post.call_args
        assert "X-Signature-256" in kwargs["headers"]


# ── dispatch_webhooks ─────────────────────────────────────────────────────────

def _make_sub(
    target_url: str,
    secret_key: str,
    subscribed_events: list,
) -> MagicMock:
    sub = MagicMock()
    sub.target_url = target_url
    sub.secret_key = secret_key
    sub.subscribed_events = subscribed_events
    return sub


def _make_db(subscriptions: list) -> MagicMock:
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = subscriptions
    return db


class TestDispatchWebhooks:
    def test_sends_to_matching_event_subscription(self):
        sub = _make_sub("https://example.com/hook", "secret", ["video.completed"])
        with patch("app.workers.webhooks.requests.post") as mock_post:
            dispatch_webhooks(_make_db([sub]), "user-1", "video.completed", {"id": "v1"})
        mock_post.assert_called_once()

    def test_sends_to_wildcard_subscription(self):
        sub = _make_sub("https://example.com/hook", "secret", ["*"])
        with patch("app.workers.webhooks.requests.post") as mock_post:
            dispatch_webhooks(_make_db([sub]), "user-1", "any.event", {})
        mock_post.assert_called_once()

    def test_skips_subscription_with_non_matching_event(self):
        sub = _make_sub("https://example.com/hook", "secret", ["video.completed"])
        with patch("app.workers.webhooks.requests.post") as mock_post:
            dispatch_webhooks(_make_db([sub]), "user-1", "other.event", {})
        mock_post.assert_not_called()

    def test_no_subscriptions_means_no_requests(self):
        with patch("app.workers.webhooks.requests.post") as mock_post:
            dispatch_webhooks(_make_db([]), "user-1", "test.event", {})
        mock_post.assert_not_called()

    def test_sends_with_correct_content_type(self):
        sub = _make_sub("https://example.com/hook", "secret", ["*"])
        with patch("app.workers.webhooks.requests.post") as mock_post:
            dispatch_webhooks(_make_db([sub]), "user-1", "test.event", {})
        _args, kwargs = mock_post.call_args
        assert kwargs["headers"]["Content-Type"] == "application/json"

    def test_sends_correct_event_header(self):
        sub = _make_sub("https://example.com/hook", "secret", ["*"])
        with patch("app.workers.webhooks.requests.post") as mock_post:
            dispatch_webhooks(_make_db([sub]), "user-1", "video.completed", {})
        _args, kwargs = mock_post.call_args
        assert kwargs["headers"]["X-ViralVision-Event"] == "video.completed"

    def test_signature_header_is_present(self):
        sub = _make_sub("https://example.com/hook", "secret", ["*"])
        with patch("app.workers.webhooks.requests.post") as mock_post:
            dispatch_webhooks(_make_db([sub]), "user-1", "ev", {})
        _args, kwargs = mock_post.call_args
        assert "X-Signature-256" in kwargs["headers"]

    def test_request_exception_does_not_propagate(self):
        sub = _make_sub("https://example.com/hook", "secret", ["*"])
        with patch(
            "app.workers.webhooks.requests.post",
            side_effect=requests.RequestException("err"),
        ):
            dispatch_webhooks(_make_db([sub]), "user-1", "test.event", {})

    def test_sends_to_multiple_subscriptions(self):
        subs = [
            _make_sub("https://a.example.com/hook", "s1", ["*"]),
            _make_sub("https://b.example.com/hook", "s2", ["*"]),
        ]
        with patch("app.workers.webhooks.requests.post") as mock_post:
            dispatch_webhooks(_make_db(subs), "user-1", "ev", {})
        assert mock_post.call_count == 2

    def test_only_sends_to_subscribed_events_among_multiple(self):
        subs = [
            _make_sub("https://a.example.com/hook", "s1", ["video.completed"]),
            _make_sub("https://b.example.com/hook", "s2", ["other.event"]),
        ]
        with patch("app.workers.webhooks.requests.post") as mock_post:
            dispatch_webhooks(_make_db(subs), "user-1", "video.completed", {})
        assert mock_post.call_count == 1
