"""Tests for services/api/app/workers/webhooks.py — pure logic only."""
import hashlib
import hmac
import json
import socket
import unittest
from unittest.mock import patch, MagicMock

import sys
import os

# Allow importing the app module without a full FastAPI startup
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestGenerateSignature(unittest.TestCase):
    """HMAC-SHA256 signature helpers."""

    def _import(self):
        from app.workers.webhooks import generate_signature
        return generate_signature

    def test_returns_hex_string(self):
        gen = self._import()
        sig = gen("secret", b"payload")
        self.assertIsInstance(sig, str)
        # SHA-256 hex digest is always 64 chars
        self.assertEqual(len(sig), 64)

    def test_is_valid_hexdigest(self):
        gen = self._import()
        sig = gen("mysecret", b"hello world")
        int(sig, 16)  # should not raise

    def test_deterministic_for_same_inputs(self):
        gen = self._import()
        a = gen("key", b"data")
        b = gen("key", b"data")
        self.assertEqual(a, b)

    def test_different_secrets_produce_different_signatures(self):
        gen = self._import()
        self.assertNotEqual(gen("secret1", b"data"), gen("secret2", b"data"))

    def test_different_payloads_produce_different_signatures(self):
        gen = self._import()
        self.assertNotEqual(gen("secret", b"payload1"), gen("secret", b"payload2"))

    def test_matches_stdlib_hmac(self):
        gen = self._import()
        secret = "test-secret"
        payload = b'{"event":"video.completed"}'
        expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        self.assertEqual(gen(secret, payload), expected)

    def test_empty_payload(self):
        gen = self._import()
        sig = gen("secret", b"")
        self.assertEqual(len(sig), 64)

    def test_unicode_secret(self):
        gen = self._import()
        sig = gen("sécret-with-ünïcödé", b"payload")
        self.assertEqual(len(sig), 64)

    def test_large_payload(self):
        gen = self._import()
        sig = gen("secret", b"x" * 100_000)
        self.assertEqual(len(sig), 64)


class TestAssertSafeWebhookUrl(unittest.TestCase):
    """SSRF protection guard for outbound webhook targets."""

    def _import(self):
        from app.workers.webhooks import assert_safe_webhook_url, UnsafeWebhookTarget
        return assert_safe_webhook_url, UnsafeWebhookTarget

    def _mock_getaddrinfo(self, ip: str):
        """Returns a mock getaddrinfo result for the given IP string."""
        import socket as s
        return [(s.AF_INET, s.SOCK_STREAM, 6, '', (ip, 80))]

    def test_rejects_loopback_127_0_0_1(self):
        fn, exc = self._import()
        with patch('socket.getaddrinfo', return_value=self._mock_getaddrinfo('127.0.0.1')):
            with self.assertRaises(exc):
                fn('http://internal-service/webhook')

    def test_rejects_localhost_by_resolution(self):
        fn, exc = self._import()
        with patch('socket.getaddrinfo', return_value=self._mock_getaddrinfo('127.0.0.1')):
            with self.assertRaises(exc):
                fn('http://localhost/webhook')

    def test_rejects_link_local_aws_metadata(self):
        fn, exc = self._import()
        with patch('socket.getaddrinfo', return_value=self._mock_getaddrinfo('169.254.169.254')):
            with self.assertRaises(exc):
                fn('http://169.254.169.254/latest/meta-data/')

    def test_rejects_rfc1918_10_block(self):
        fn, exc = self._import()
        with patch('socket.getaddrinfo', return_value=self._mock_getaddrinfo('10.0.0.1')):
            with self.assertRaises(exc):
                fn('http://internal.corp/hook')

    def test_rejects_rfc1918_172_16_block(self):
        fn, exc = self._import()
        with patch('socket.getaddrinfo', return_value=self._mock_getaddrinfo('172.16.0.5')):
            with self.assertRaises(exc):
                fn('http://internal.corp/hook')

    def test_rejects_rfc1918_192_168_block(self):
        fn, exc = self._import()
        with patch('socket.getaddrinfo', return_value=self._mock_getaddrinfo('192.168.1.100')):
            with self.assertRaises(exc):
                fn('http://router.local/hook')

    def test_rejects_ftp_scheme(self):
        fn, exc = self._import()
        with self.assertRaises(exc):
            fn('ftp://example.com/hook')

    def test_rejects_file_scheme(self):
        fn, exc = self._import()
        with self.assertRaises(exc):
            fn('file:///etc/passwd')

    def test_rejects_missing_hostname(self):
        fn, exc = self._import()
        with self.assertRaises(exc):
            fn('http://')

    def test_rejects_dns_resolution_failure(self):
        fn, exc = self._import()
        with patch('socket.getaddrinfo', side_effect=socket.gaierror('Name not resolved')):
            with self.assertRaises(exc):
                fn('http://nonexistent.invalid/hook')

    def test_accepts_public_https_url(self):
        fn, exc = self._import()
        # 93.184.216.34 is example.com — a real public IP
        with patch('socket.getaddrinfo', return_value=self._mock_getaddrinfo('93.184.216.34')):
            # Should NOT raise
            fn('https://example.com/webhook')

    def test_accepts_public_http_url(self):
        fn, exc = self._import()
        with patch('socket.getaddrinfo', return_value=self._mock_getaddrinfo('203.0.113.1')):
            fn('http://webhook-receiver.example.com/events')

    def test_rejects_ipv6_loopback(self):
        fn, exc = self._import()
        import socket as s
        with patch('socket.getaddrinfo', return_value=[(s.AF_INET6, s.SOCK_STREAM, 6, '', ('::1', 80, 0, 0))]):
            with self.assertRaises(exc):
                fn('http://[::1]/hook')

    def test_rejects_0_0_0_0_unspecified(self):
        fn, exc = self._import()
        with patch('socket.getaddrinfo', return_value=self._mock_getaddrinfo('0.0.0.0')):
            with self.assertRaises(exc):
                fn('http://unspecified.example/hook')


class TestDeliverWithRetries(unittest.TestCase):
    """deliver_with_retries retry and signature behavior (no real HTTP)."""

    def _import(self):
        from app.workers.webhooks import deliver_with_retries
        return deliver_with_retries

    def test_returns_true_on_first_success(self):
        fn = self._import()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('93.184.216.34', 443))]):
            with patch('requests.post', return_value=mock_resp) as mock_post:
                result = fn('https://example.com/hook', 'secret', 'video.completed', {'id': '1'})
        self.assertTrue(result)
        self.assertEqual(mock_post.call_count, 1)

    def test_returns_false_for_unsafe_url(self):
        fn = self._import()
        with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('127.0.0.1', 80))]):
            result = fn('http://localhost/hook', 'secret', 'test.event', {})
        self.assertFalse(result)

    def test_returns_false_after_all_retries_fail(self):
        fn = self._import()
        with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('93.184.216.34', 443))]):
            with patch('requests.post', side_effect=Exception('Connection error')):
                with patch('time.sleep'):  # Don't actually sleep in tests
                    result = fn('https://example.com/hook', 'secret', 'event', {})
        self.assertFalse(result)

    def test_returns_true_on_201_status(self):
        fn = self._import()
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('93.184.216.34', 443))]):
            with patch('requests.post', return_value=mock_resp):
                result = fn('https://example.com/hook', 'secret', 'event', {})
        self.assertTrue(result)

    def test_retries_on_non_2xx_status(self):
        fn = self._import()
        resp_fail = MagicMock()
        resp_fail.status_code = 500
        resp_ok = MagicMock()
        resp_ok.status_code = 200
        with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('93.184.216.34', 443))]):
            with patch('requests.post', side_effect=[resp_fail, resp_ok]):
                with patch('time.sleep'):
                    result = fn('https://example.com/hook', 'secret', 'event', {})
        self.assertTrue(result)

    def test_signature_header_is_set(self):
        fn = self._import()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('93.184.216.34', 443))]):
            with patch('requests.post', return_value=mock_resp) as mock_post:
                fn('https://example.com/hook', 'mysecret', 'video.started', {'id': 'v1'})
        call_kwargs = mock_post.call_args
        headers = call_kwargs.kwargs.get('headers', call_kwargs[1].get('headers', {}))
        self.assertIn('X-Signature-256', headers)
        self.assertEqual(len(headers['X-Signature-256']), 64)

    def test_does_not_follow_redirects(self):
        fn = self._import()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('93.184.216.34', 443))]):
            with patch('requests.post', return_value=mock_resp) as mock_post:
                fn('https://example.com/hook', 'secret', 'event', {})
        call_kwargs = mock_post.call_args
        allow_redirects = call_kwargs.kwargs.get('allow_redirects', call_kwargs[1].get('allow_redirects'))
        self.assertFalse(allow_redirects)


if __name__ == '__main__':
    unittest.main()
