import sys
import os

# Allow importing from services/api/app without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'services', 'api'))
