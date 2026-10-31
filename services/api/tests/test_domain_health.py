"""Tests for app.workers.domain_health – verify_cname_target and get_ssl_expiry_days.

Both dns (dnspython) and celery are not installed in CI. We inject mocks into
sys.modules BEFORE importing the production module so that the module-level
`import dns.resolver` and the celery_app import succeed without the real packages.

conftest.py already patches SQLAlchemy and sets DATABASE_URL.
"""
import os
import ssl
import socket
import sys
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch, call

import pytest

# ---------------------------------------------------------------------------
# Inject stubs for unavailable packages BEFORE any app import.
# ---------------------------------------------------------------------------

_mock_dns = MagicMock()
sys.modules.setdefault("dns", _mock_dns)
sys.modules.setdefault("dns.resolver", _mock_dns.resolver)

_mock_celery_module = MagicMock()
_mock_kombu_module = MagicMock()
sys.modules.setdefault("celery", _mock_celery_module)
sys.modules.setdefault("kombu", _mock_kombu_module)

_API_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.workers.domain_health import (
    verify_cname_target,
    get_ssl_expiry_days,
    PLATFORM_CNAME_TARGET,
)


# ---------------------------------------------------------------------------
# verify_cname_target
# ---------------------------------------------------------------------------

class TestVerifyCnameTarget:
    def _make_resolver(self, cname_target: str):
        mock_record = MagicMock()
        mock_record.target = cname_target + "."
        mock_resolver = MagicMock()
        mock_resolver.resolve.return_value = [mock_record]
        return mock_resolver

    def test_returns_true_when_cname_matches(self):
        mock_resolver = self._make_resolver(PLATFORM_CNAME_TARGET)
        with patch("app.workers.domain_health.dns.resolver.Resolver", return_value=mock_resolver):
            assert verify_cname_target("custom.example.com") is True

    def test_returns_false_when_cname_does_not_match(self):
        mock_resolver = self._make_resolver("other-provider.com")
        with patch("app.workers.domain_health.dns.resolver.Resolver", return_value=mock_resolver):
            assert verify_cname_target("custom.example.com") is False

    def test_returns_false_when_multiple_records_none_match(self):
        rec1 = MagicMock()
        rec1.target = "something-else.io."
        rec2 = MagicMock()
        rec2.target = "another-cdn.net."
        mock_resolver = MagicMock()
        mock_resolver.resolve.return_value = [rec1, rec2]
        with patch("app.workers.domain_health.dns.resolver.Resolver", return_value=mock_resolver):
            assert verify_cname_target("custom.example.com") is False

    def test_returns_true_when_first_of_multiple_records_matches(self):
        rec_match = MagicMock()
        rec_match.target = PLATFORM_CNAME_TARGET + "."
        rec_other = MagicMock()
        rec_other.target = "other.com."
        mock_resolver = MagicMock()
        mock_resolver.resolve.return_value = [rec_match, rec_other]
        with patch("app.workers.domain_health.dns.resolver.Resolver", return_value=mock_resolver):
            assert verify_cname_target("custom.example.com") is True

    def test_returns_false_on_dns_resolution_exception(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve.side_effect = Exception("NXDOMAIN")
        with patch("app.workers.domain_health.dns.resolver.Resolver", return_value=mock_resolver):
            assert verify_cname_target("nonexistent.invalid") is False

    def test_returns_false_on_no_answer_exception(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve.side_effect = Exception("No answer")
        with patch("app.workers.domain_health.dns.resolver.Resolver", return_value=mock_resolver):
            assert verify_cname_target("no-cname.example.com") is False

    def test_resolver_uses_public_nameservers(self):
        mock_resolver = self._make_resolver(PLATFORM_CNAME_TARGET)
        with patch("app.workers.domain_health.dns.resolver.Resolver", return_value=mock_resolver) as MockResolverCls:
            verify_cname_target("test.domain.com")
            instance = MockResolverCls.return_value
            assert "1.1.1.1" in instance.nameservers or instance.nameservers == ["1.1.1.1", "8.8.8.8"]

    def test_return_type_is_bool(self):
        mock_resolver = self._make_resolver(PLATFORM_CNAME_TARGET)
        with patch("app.workers.domain_health.dns.resolver.Resolver", return_value=mock_resolver):
            result = verify_cname_target("custom.example.com")
        assert isinstance(result, bool)


# ---------------------------------------------------------------------------
# get_ssl_expiry_days
# ---------------------------------------------------------------------------

class TestGetSslExpiryDays:
    def _make_ssl_context_and_cert(self, days_until_expiry: float):
        """Build mock SSL context + socket that returns a cert expiring in N days."""
        future_dt = datetime.now(timezone.utc) + timedelta(days=days_until_expiry)
        not_after = future_dt.strftime("%b %d %H:%M:%S %Y GMT")

        mock_ssock = MagicMock()
        mock_ssock.getpeercert.return_value = {"notAfter": not_after}
        mock_ssock.__enter__ = MagicMock(return_value=mock_ssock)
        mock_ssock.__exit__ = MagicMock(return_value=False)

        mock_sock = MagicMock()
        mock_sock.__enter__ = MagicMock(return_value=mock_sock)
        mock_sock.__exit__ = MagicMock(return_value=False)

        mock_context = MagicMock()
        mock_context.wrap_socket.return_value = mock_ssock

        return mock_context, mock_sock

    def test_returns_positive_days_for_future_cert(self):
        mock_context, mock_sock = self._make_ssl_context_and_cert(30.0)
        with patch("ssl.create_default_context", return_value=mock_context):
            with patch("socket.create_connection", return_value=mock_sock):
                result = get_ssl_expiry_days("example.com")
        assert result > 0

    def test_approximately_correct_days_returned(self):
        mock_context, mock_sock = self._make_ssl_context_and_cert(30.0)
        with patch("ssl.create_default_context", return_value=mock_context):
            with patch("socket.create_connection", return_value=mock_sock):
                result = get_ssl_expiry_days("example.com")
        # Allow ±1 day for timing skew in test execution
        assert 28.0 < result < 32.0

    def test_returns_zero_for_expired_cert(self):
        # Cert expired 10 days ago
        mock_context, mock_sock = self._make_ssl_context_and_cert(-10.0)
        with patch("ssl.create_default_context", return_value=mock_context):
            with patch("socket.create_connection", return_value=mock_sock):
                result = get_ssl_expiry_days("example.com")
        assert result == 0.0

    def test_returns_float(self):
        mock_context, mock_sock = self._make_ssl_context_and_cert(90.0)
        with patch("ssl.create_default_context", return_value=mock_context):
            with patch("socket.create_connection", return_value=mock_sock):
                result = get_ssl_expiry_days("example.com")
        assert isinstance(result, float)

    def test_custom_port_passed_to_create_connection(self):
        mock_context, mock_sock = self._make_ssl_context_and_cert(60.0)
        captured = {}

        def fake_create_connection(address, timeout):
            captured["address"] = address
            return mock_sock

        with patch("ssl.create_default_context", return_value=mock_context):
            with patch("socket.create_connection", side_effect=fake_create_connection):
                get_ssl_expiry_days("example.com", port=8443)

        assert captured["address"] == ("example.com", 8443)

    def test_default_port_is_443(self):
        mock_context, mock_sock = self._make_ssl_context_and_cert(30.0)
        captured = {}

        def fake_create_connection(address, timeout):
            captured["address"] = address
            return mock_sock

        with patch("ssl.create_default_context", return_value=mock_context):
            with patch("socket.create_connection", side_effect=fake_create_connection):
                get_ssl_expiry_days("example.com")

        assert captured["address"][1] == 443

    def test_tls_minimum_version_set_to_1_2(self):
        mock_context, mock_sock = self._make_ssl_context_and_cert(30.0)
        with patch("ssl.create_default_context", return_value=mock_context):
            with patch("socket.create_connection", return_value=mock_sock):
                get_ssl_expiry_days("example.com")
        assert mock_context.minimum_version == ssl.TLSVersion.TLSv1_2

    def test_result_never_negative(self):
        # Cert that expired a year ago
        mock_context, mock_sock = self._make_ssl_context_and_cert(-365.0)
        with patch("ssl.create_default_context", return_value=mock_context):
            with patch("socket.create_connection", return_value=mock_sock):
                result = get_ssl_expiry_days("example.com")
        assert result >= 0.0

    def test_long_lived_cert_returns_large_value(self):
        mock_context, mock_sock = self._make_ssl_context_and_cert(365.0)
        with patch("ssl.create_default_context", return_value=mock_context):
            with patch("socket.create_connection", return_value=mock_sock):
                result = get_ssl_expiry_days("example.com")
        assert result > 300.0
