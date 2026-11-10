"""Test configuration: add the services/api root to sys.path and stub heavy
optional dependencies (ML libraries, redis, anthropic SDK) so pure-logic
tests run without those packages installed.
"""
import sys
import os
from types import ModuleType
from unittest.mock import MagicMock

# Make `app.*` importable from the tests directory
_API_ROOT = os.path.join(os.path.dirname(__file__), '..')
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)


def _stub(name: str, **attrs) -> MagicMock:
    m = MagicMock(spec=ModuleType(name))
    for k, v in attrs.items():
        setattr(m, k, v)
    sys.modules[name] = m
    return m


# Stub the Anthropic SDK so anthropic_client.py can be imported
if 'anthropic' not in sys.modules:
    _stub('anthropic', AsyncAnthropic=MagicMock)
