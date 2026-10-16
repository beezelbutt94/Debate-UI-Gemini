"""Unit tests for services/api/app/workers/webhooks.py

Tests assert_safe_webhook_url (SSRF guard) and generate_signature
without any network calls or database access.
"""
import hashlib
import hmac
import sys
import os

import pytest

# Add the services/api directory to sys.path so imports resolve correctly
# without needing an editable install.
_API_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "services", "api")
sys.path.insert(0, _API_ROOT)

# Stub heavy dependencies that are not installed in the test environment
# (redis, sqlalchemy, etc.) before importing the target module.
import types


def _make_stub(name: str) -> types.ModuleType:
    m = types.ModuleType(name)
    sys.modules[name] = m
    return m


for _mod_name in [
    "redis",
    "sqlalchemy",
    "sqlalchemy.orm",
    "sqlalchemy.orm.session",
    "celery",
    "celery.app",
    "kombu",
    "stripe",
    "boto3",
    "kubernetes",
    "prometheus_client",
    "numpy",
    "anthropic",
    "pydantic",
]:
    if _mod_name not in sys.modules:
        _make_stub(_mod_name)

# sqlalchemy.orm needs a real Session attribute for the import to succeed
_orm_stub = sys.modules["sqlalchemy.orm"]
_orm_stub.Session = object  # type: ignore

# Stub out app.core.models (needs sqlalchemy) and app.core.database
for _stub in ["app.core", "app.core.models", "app.core.database"]:
    if _stub not in sys.modules:
        _make_stub(_stub)

_models_stub = sys.modules["app.core.models"]
_models_stub.WebhookSubscription = object  # type: ignore

# Now we can safely import the real webhook module
from app.workers.webhooks import assert_safe_webhook_url, generate_signature, UnsafeWebhookTarget  # noqa: E402


# ── assert_safe_webhook_url ────────────────────────────────────────────────────

class TestAssertSafeWebhookUrl:
    def test_accepts_https_public_url(self):
        """A real public HTTPS URL should not raise."""
        assert_safe_webhook_url("https://example.com/hook")

    def test_accepts_http_public_url(self):
        assert_safe_webhook_url("http://example.com/hook")

    def test_rejects_localhost(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("http://localhost/hook")

    def test_rejects_loopback_ipv4(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("http://127.0.0.1/hook")

    def test_rejects_loopback_ipv4_alt(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("http://127.0.0.2/hook")

    def test_rejects_private_rfc1918_10(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("http://10.0.0.1/hook")

    def test_rejects_private_rfc1918_192_168(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("http://192.168.1.1/hook")

    def test_rejects_private_rfc1918_172_16(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("http://172.16.0.1/hook")

    def test_rejects_link_local_cloud_metadata(self):
        """169.254.169.254 is the AWS/GCP instance metadata endpoint."""
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("http://169.254.169.254/latest/meta-data/")

    def test_rejects_unresolvable_hostname(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("https://this-host-definitely-does-not-exist.invalid/hook")

    def test_rejects_unsupported_scheme_ftp(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("ftp://example.com/hook")

    def test_rejects_unsupported_scheme_file(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("file:///etc/passwd")

    def test_rejects_url_with_no_hostname(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("https:///no-host")

    def test_error_type_is_value_error_subclass(self):
        """UnsafeWebhookTarget must be a ValueError so callers can catch broadly."""
        assert issubclass(UnsafeWebhookTarget, ValueError)

    def test_loopback_ipv6(self):
        with pytest.raises(UnsafeWebhookTarget):
            assert_safe_webhook_url("http://[::1]/hook")


# ── generate_signature ────────────────────────────────────────────────────────

class TestGenerateSignature:
    def _expected(self, secret: str, payload: bytes) -> str:
        return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    def test_returns_hex_string(self):
        sig = generate_signature("secret", b"payload")
        assert all(c in "0123456789abcdef" for c in sig)

    def test_matches_hmac_sha256(self):
        secret = "mysecret"
        payload = b'{"event":"video.completed"}'
        assert generate_signature(secret, payload) == self._expected(secret, payload)

    def test_deterministic(self):
        sig1 = generate_signature("sec", b"data")
        sig2 = generate_signature("sec", b"data")
        assert sig1 == sig2

    def test_different_secrets_produce_different_signatures(self):
        payload = b"same payload"
        assert generate_signature("secret1", payload) != generate_signature("secret2", payload)

    def test_different_payloads_produce_different_signatures(self):
        secret = "samesecret"
        assert generate_signature(secret, b"payload1") != generate_signature(secret, b"payload2")

    def test_output_length_is_64_chars(self):
        """SHA-256 hex digest is always 64 characters."""
        assert len(generate_signature("s", b"p")) == 64

    def test_empty_payload(self):
        sig = generate_signature("secret", b"")
        assert sig == self._expected("secret", b"")

    def test_unicode_secret(self):
        sig = generate_signature("sécret", b"data")
        assert sig == self._expected("sécret", b"data")

    def test_binary_payload(self):
        payload = bytes(range(256))
        sig = generate_signature("s", payload)
        assert sig == self._expected("s", payload)

    def test_large_payload(self):
        payload = b"x" * 1_000_000
        sig = generate_signature("s", payload)
        assert len(sig) == 64
