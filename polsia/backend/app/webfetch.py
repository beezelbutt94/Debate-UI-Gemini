"""Fetch public web pages as plain text, refusing internal network targets.

URLs reach this module from webhook payloads (a prospect's email domain) and
operator input, so every hop is resolved and checked: no loopback, private,
link-local or reserved addresses, and redirects are re-validated.
"""

import ipaddress
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import httpx

MAX_BYTES = 2_000_000
MAX_REDIRECTS = 3
USER_AGENT = "Mozilla/5.0 (compatible; PolsiaResearchBot/1.0)"


class FetchError(RuntimeError):
    pass


def _assert_public(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise FetchError(f"Refusing non-http(s) URL: {url}")
    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise FetchError(f"Cannot resolve {parsed.hostname}") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise FetchError(f"Refusing non-public address {ip} for {parsed.hostname}")


class _TextExtractor(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "head"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if not self._skip and data.strip():
            self.parts.append(data.strip())


def html_to_text(html: str) -> str:
    parser = _TextExtractor()
    parser.feed(html)
    return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()


def fetch_text(url: str, max_chars: int = 12_000, timeout: float = 15.0) -> str:
    with httpx.Client(follow_redirects=False, timeout=timeout, headers={"User-Agent": USER_AGENT}) as client:
        for _ in range(MAX_REDIRECTS + 1):
            _assert_public(url)
            resp = client.get(url)
            if resp.is_redirect and "location" in resp.headers:
                url = urljoin(url, resp.headers["location"])
                continue
            resp.raise_for_status()
            body = resp.content[:MAX_BYTES].decode(resp.encoding or "utf-8", errors="replace")
            text = html_to_text(body) if "html" in resp.headers.get("content-type", "html") else body
            return text[:max_chars]
    raise FetchError(f"Too many redirects fetching {url}")
