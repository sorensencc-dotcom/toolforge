from __future__ import annotations

import os
import shutil
import tempfile
import uuid
from pathlib import Path


def _resolve_writable_test_dir() -> Path:
    candidates = [
        Path(__file__).resolve().parent / ".tmp",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Temp" if os.environ.get("LOCALAPPDATA") else None,
        Path(os.environ.get("USERPROFILE", "")) / "AppData" / "Local" / "Temp" if os.environ.get("USERPROFILE") else None,
        Path(r"C:\tmp"),
        Path(r"C:\Temp"),
        Path(os.environ.get("TEMP", "")) if os.environ.get("TEMP") else None,
        Path(os.environ.get("TMP", "")) if os.environ.get("TMP") else None,
        Path(tempfile.gettempdir()),
        Path.cwd() / ".test_tmp",
    ]
    for candidate in candidates:
        if candidate is None:
            continue
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            probe = candidate / f".probe_{uuid.uuid4().hex}"
            probe.write_text("probe", encoding="utf-8")
            probe.unlink()
            return candidate.resolve()
        except Exception:
            continue
    fallback = Path.cwd() / ".test_tmp"
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback.resolve()


TEST_TMP_DIR = _resolve_writable_test_dir()

# Point standard tempfile to the probe-verified writable directory
tempfile.tempdir = str(TEST_TMP_DIR)
os.environ["TEMP"] = str(TEST_TMP_DIR)
os.environ["TMP"] = str(TEST_TMP_DIR)


class ManagedTempDir:
    """Explicit, verified writable temporary directory helper for test fixtures."""

    def __init__(self, prefix: str = "test_"):
        self.root = _resolve_writable_test_dir()
        self.path = self.root / f"{prefix}{uuid.uuid4().hex[:12]}"
        self.path.mkdir(parents=True, exist_ok=True)

    @property
    def name(self) -> str:
        return str(self.path)

    def cleanup(self) -> None:
        if self.path.exists():
            shutil.rmtree(str(self.path), ignore_errors=True)

    def __enter__(self) -> Path:
        return self.path

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.cleanup()
