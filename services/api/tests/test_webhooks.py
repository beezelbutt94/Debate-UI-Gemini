"""Tests for app.workers.webhooks – HMAC signing, SSRF guard, delivery."""
import hashlib
import hmac
import ipaddress
import json
import socket
import time
import pytest
from unittest.mock import MagicMock, patch, call


# ---------------------------------------------------------------------------
# Import the module under test (no DB / Redis connection on import)
# ---------------------------------------------------------------------------
from app.workers.webhooks import (
    UnsafeWebhookTarget,
    assert_safe_webhook_url,
    deliver_with_retries,
    dispatch_webhooks,
    generate_signature,
    RETRY_SCHEDULE_SECONDS,
)


# ---------------------------------------------------------------------------
# generate_signature
# ---------------------------------------------------------------------------
class TestGenerateSignature:
    def test_returns_hex_string(self):
        sig = generate_signature("secret", b"payload")
        assert isinstance(sig, str)
        assert all(c in "0123456789abcdef" for c in sig)

    def test_correct_hmac_sha256(self):
        secret = "mysecret"
        payload = b'{"event":"video.completed"}'
        expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        assert generate_signature(secret, payload) == expected

    def test_deterministic(self):
        sig1 = generate_signature("k", b"data")
        sig2 = generate_signature("k", b"data")
        assert sig1 == sig2

    def test_different_secrets_produce_different_signatures(self):
        assert generate_signature("key1", b"data") != generate_signature("key2", b"data")

    def test_different_payloads_produce_different_signatures(self):
        assert generate_signature("key", b"dataA") != generate_signature("key", b"dataB")

    def test_length_is_64_hex_chars(self):
        # SHA-256 produces 32 bytes = 64 hex chars
        sig = generate_signature("anything", b"anything")
        assert len(sig) == 64

    def test_empty_payload(self):
        sig = generate_signature("secret", b"")
        assert len(sig) == 64

    def test_unicode_secret(self):
        sig = generate_signature("sécret", b"payload")
        assert len(sig) == 64


# ---------------------------------------------------------------------------
# assert_safe_webhook_url – scheme checks (no DNS needed)
# ---------------------------------------------------------------------------
class TestAssertSafeWebhookUrlScheme:
    def _fake_resolve(self, host, *args, **kwargs):
        """Return a fake public IP to allow the URL past the IP check."""
        return [(socket.AF_INET, None, None, None, ("93.184.216.34", 443))]

    def test_ftp_scheme_rejected(self):
        with pytest.raises(UnsafeWebhookTarget, match="unsupported scheme"):
            assert_safe_webhook_url("ftp://example.com/hook")

    def test_file_scheme_rejected(self):
        with pytest.raises(UnsafeWebhookTarget, match="unsupported scheme"):
            assert_safe_webhook_url("file:///etc/passwd")

    def test_http_scheme_accepted(self):
        with patch("socket.getaddrinfo", side_effect=self._fake_resolve):
            assert_safe_webhook_url("http://example.com/hook")  # should not raise

    def test_https_scheme_accepted(self):
        with patch("socket.getaddrinfo", side_effect=self._fake_resolve):
            assert_safe_webhook_url("https://example.com/hook")

    def test_url_without_hostname_rejected(self):
        with pytest.raises(UnsafeWebhookTarget, match="no hostname"):
            assert_safe_webhook_url("https://")


# ---------------------------------------------------------------------------
# assert_safe_webhook_url – SSRF IP checks
# ---------------------------------------------------------------------------
class TestAssertSafeWebhookUrlSsrf:
    def _make_getaddrinfo(self, ip: str):
        """Return a getaddrinfo mock that resolves to a single IP."""
        def _getaddrinfo(host, port, *args, **kwargs):
            return [(socket.AF_INET, None, None, None, (ip, port or 80))]
        return _getaddrinfo

    def test_loopback_ipv4_rejected(self):
        with patch("socket.getaddrinfo", side_effect=self._make_getaddrinfo("127.0.0.1")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("https://evil.example.com/hook")

    def test_private_10_rejected(self):
        with patch("socket.getaddrinfo", side_effect=self._make_getaddrinfo("10.0.0.1")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("https://internal.corp/hook")

    def test_private_172_16_rejected(self):
        with patch("socket.getaddrinfo", side_effect=self._make_getaddrinfo("172.16.0.5")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("https://whatever.example.com/hook")

    def test_private_192_168_rejected(self):
        with patch("socket.getaddrinfo", side_effect=self._make_getaddrinfo("192.168.1.1")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("https://foo.example.com/hook")

    def test_link_local_metadata_endpoint_rejected(self):
        # AWS/GCP/Azure instance metadata service
        with patch("socket.getaddrinfo", side_effect=self._make_getaddrinfo("169.254.169.254")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("https://metadata.example.com/hook")

    def test_public_ip_accepted(self):
        with patch("socket.getaddrinfo", side_effect=self._make_getaddrinfo("93.184.216.34")):
            assert_safe_webhook_url("https://example.com/hook")  # should not raise

    def test_unresolvable_host_rejected(self):
        with patch("socket.getaddrinfo", side_effect=socket.gaierror("Name not found")):
            with pytest.raises(UnsafeWebhookTarget, match="could not resolve"):
                assert_safe_webhook_url("https://nonexistent.invalid/hook")

    def test_multicast_ip_rejected(self):
        with patch("socket.getaddrinfo", side_effect=self._make_getaddrinfo("224.0.0.1")):
            with pytest.raises(UnsafeWebhookTarget, match="non-public"):
                assert_safe_webhook_url("https://foo.example.com/hook")


# ---------------------------------------------------------------------------
# dispatch_webhooks
# ---------------------------------------------------------------------------
class TestDispatchWebhooks:
    def _make_db(self, subscriptions):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = subscriptions
        return db

    def _make_sub(self, user_id="u1", target_url="https://receiver.example.com/hook",
                  secret_key="topsecret", events=None, is_active=True):
        sub = MagicMock()
        sub.user_id = user_id
        sub.target_url = target_url
        sub.secret_key = secret_key
        sub.subscribed_events = events if events is not None else ["*"]
        sub.is_active = is_active
        return sub

    def test_posts_to_target_url(self):
        sub = self._make_sub()
        db = self._make_db([sub])
        with patch("requests.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=200)
            dispatch_webhooks(db, "u1", "video.completed", {"video_id": "v1"})
        mock_post.assert_called_once()
        assert mock_post.call_args[0][0] == "https://receiver.example.com/hook"

    def test_wildcard_subscription_receives_any_event(self):
        sub = self._make_sub(events=["*"])
        db = self._make_db([sub])
        with patch("requests.post") as mock_post:
            dispatch_webhooks(db, "u1", "anything.happened", {})
        mock_post.assert_called_once()

    def test_specific_event_subscription_receives_matching_event(self):
        sub = self._make_sub(events=["video.completed"])
        db = self._make_db([sub])
        with patch("requests.post") as mock_post:
            dispatch_webhooks(db, "u1", "video.completed", {})
        mock_post.assert_called_once()

    def test_specific_event_subscription_skips_non_matching_event(self):
        sub = self._make_sub(events=["video.completed"])
        db = self._make_db([sub])
        with patch("requests.post") as mock_post:
            dispatch_webhooks(db, "u1", "video.failed", {})
        mock_post.assert_not_called()

    def test_payload_includes_event_and_data(self):
        sub = self._make_sub()
        db = self._make_db([sub])
        with patch("requests.post") as mock_post:
            dispatch_webhooks(db, "u1", "video.completed", {"video_id": "v42"})
        raw = mock_post.call_args[1]["data"]
        body = json.loads(raw)
        assert body["event"] == "video.completed"
        assert body["data"]["video_id"] == "v42"

    def test_signature_header_present(self):
        sub = self._make_sub(secret_key="secret")
        db = self._make_db([sub])
        with patch("requests.post") as mock_post:
            dispatch_webhooks(db, "u1", "video.completed", {})
        headers = mock_post.call_args[1]["headers"]
        assert "X-Signature-256" in headers

    def test_signature_is_correct(self):
        sub = self._make_sub(secret_key="secret")
        db = self._make_db([sub])
        with patch("requests.post") as mock_post:
            dispatch_webhooks(db, "u1", "video.completed", {"video_id": "v1"})
        headers = mock_post.call_args[1]["headers"]
        raw = mock_post.call_args[1]["data"]
        expected = generate_signature("secret", raw)
        assert headers["X-Signature-256"] == expected

    def test_request_exception_is_swallowed(self):
        sub = self._make_sub()
        db = self._make_db([sub])
        import requests
        with patch("requests.post", side_effect=requests.RequestException("timeout")):
            # Should not raise
            dispatch_webhooks(db, "u1", "video.completed", {})

    def test_multiple_subscriptions_all_receive_event(self):
        subs = [self._make_sub(target_url=f"https://recv{i}.example.com/hook") for i in range(3)]
        db = self._make_db(subs)
        with patch("requests.post") as mock_post:
            dispatch_webhooks(db, "u1", "video.completed", {})
        assert mock_post.call_count == 3


# ---------------------------------------------------------------------------
# deliver_with_retries
# ---------------------------------------------------------------------------
class TestDeliverWithRetries:
    def _public_getaddrinfo(self, host, port, *args, **kwargs):
        return [(socket.AF_INET, None, None, None, ("93.184.216.34", port or 443))]

    def test_returns_true_on_first_200(self):
        with patch("socket.getaddrinfo", side_effect=self._public_getaddrinfo):
            with patch("requests.post") as mock_post:
                mock_post.return_value = MagicMock(status_code=200)
                result = deliver_with_retries("https://recv.example.com/hook", "secret", "ev", {})
        assert result is True

    def test_returns_true_on_201(self):
        with patch("socket.getaddrinfo", side_effect=self._public_getaddrinfo):
            with patch("requests.post") as mock_post:
                mock_post.return_value = MagicMock(status_code=201)
                result = deliver_with_retries("https://recv.example.com/hook", "secret", "ev", {})
        assert result is True

    def test_returns_false_after_all_retries_fail(self):
        import requests as req
        with patch("socket.getaddrinfo", side_effect=self._public_getaddrinfo):
            with patch("requests.post", side_effect=req.RequestException("timeout")):
                with patch("time.sleep"):  # skip actual sleep
                    result = deliver_with_retries("https://recv.example.com/hook", "secret", "ev", {})
        assert result is False

    def test_retries_on_non_2xx_then_succeeds(self):
        import requests as req
        responses = [
            MagicMock(status_code=503),
            MagicMock(status_code=503),
            MagicMock(status_code=200),
        ]
        with patch("socket.getaddrinfo", side_effect=self._public_getaddrinfo):
            with patch("requests.post", side_effect=responses):
                with patch("time.sleep"):
                    result = deliver_with_retries("https://recv.example.com/hook", "secret", "ev", {})
        assert result is True

    def test_returns_false_for_ssrf_target_without_retrying(self):
        """A private-IP target must be refused without any HTTP attempt."""
        def private_getaddrinfo(host, port, *args, **kwargs):
            return [(socket.AF_INET, None, None, None, ("127.0.0.1", port or 80))]

        with patch("socket.getaddrinfo", side_effect=private_getaddrinfo):
            with patch("requests.post") as mock_post:
                result = deliver_with_retries("https://internal.example.com/hook", "secret", "ev", {})
        assert result is False
        mock_post.assert_not_called()

    def test_payload_contains_event_name(self):
        with patch("socket.getaddrinfo", side_effect=self._public_getaddrinfo):
            with patch("requests.post") as mock_post:
                mock_post.return_value = MagicMock(status_code=200)
                deliver_with_retries("https://recv.example.com/hook", "s", "my.event", {"k": "v"})
        raw = mock_post.call_args[1]["data"]
        body = json.loads(raw)
        assert body["event"] == "my.event"
        assert body["data"] == {"k": "v"}

    def test_does_not_follow_redirects(self):
        """allow_redirects must be False to block redirect-based SSRF."""
        with patch("socket.getaddrinfo", side_effect=self._public_getaddrinfo):
            with patch("requests.post") as mock_post:
                mock_post.return_value = MagicMock(status_code=200)
                deliver_with_retries("https://recv.example.com/hook", "s", "ev", {})
        assert mock_post.call_args[1]["allow_redirects"] is False

    def test_correct_number_of_retry_attempts(self):
        """Should attempt exactly len(RETRY_SCHEDULE_SECONDS) times on total failure."""
        import requests as req
        with patch("socket.getaddrinfo", side_effect=self._public_getaddrinfo):
            with patch("requests.post", side_effect=req.RequestException("timeout")):
                with patch("time.sleep"):
                    deliver_with_retries("https://recv.example.com/hook", "s", "ev", {})
