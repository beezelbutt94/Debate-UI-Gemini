"""Pytest configuration: prepend services/api so Python finds the app package
before the Next.js app/ directory at the repo root."""
import sys
import os

_API_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/api'))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)
