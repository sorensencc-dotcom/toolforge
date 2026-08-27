from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from test_helpers import TEST_TMP_DIR

tempfile.tempdir = str(TEST_TMP_DIR)
os.environ["TEMP"] = str(TEST_TMP_DIR)
os.environ["TMP"] = str(TEST_TMP_DIR)
