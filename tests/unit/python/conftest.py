"""Bootstrap the sys.path so that `from app.xxx import yyy` resolves when
tests run from the repo root."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api'))
