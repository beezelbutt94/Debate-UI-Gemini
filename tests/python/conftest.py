"""Shared pytest configuration and path setup for the Python service tests."""
import sys
import os

# Make the services/api directory importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../services/api'))
