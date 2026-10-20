"""Makes services/api importable from all Python tests in this directory."""
import sys
import os

# Add services/api to sys.path so `from app.xxx import yyy` resolves
services_api = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'api')
if services_api not in sys.path:
    sys.path.insert(0, os.path.abspath(services_api))
