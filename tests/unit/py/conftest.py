"""Shared mock setup: stubs out heavy optional imports before any test
module pulls in the service code.  This file is auto-loaded by pytest
before any test in the package runs."""
import sys
from unittest.mock import MagicMock

# Stub the `anthropic` SDK so anthropic_client.py can be imported
# without the library installed.
if "anthropic" not in sys.modules:
    anthropic_mock = MagicMock()
    anthropic_mock.AsyncAnthropic = MagicMock
    sys.modules["anthropic"] = anthropic_mock

# Stub kubernetes so k8s_controller can be imported if needed
if "kubernetes" not in sys.modules:
    sys.modules["kubernetes"] = MagicMock()
    sys.modules["kubernetes.client"] = MagicMock()
    sys.modules["kubernetes.config"] = MagicMock()
