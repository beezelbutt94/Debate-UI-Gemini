import sys
import os

# Ensure `services/api` is on sys.path so `from app.xxx import yyy` works.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
