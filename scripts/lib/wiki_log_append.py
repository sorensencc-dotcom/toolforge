"""Shared Log.md append helper with rotation.

Without rotation every daily bot appends forever and the file grows
unbounded (hit 16MB / 495k lines in wiki/Log.md). Mirrors
scripts/lib/wiki-log-append.mjs.
"""
import os

MAX_LOG_BYTES = 500 * 1024  # 500KB


def append_to_log_file(log_file_path, entry):
    _rotate_if_oversized(log_file_path)
    with open(log_file_path, 'a', encoding='utf-8') as f:
        f.write(entry)


def _rotate_if_oversized(log_file_path):
    try:
        size = os.path.getsize(log_file_path)
    except OSError:
        return
    if size < MAX_LOG_BYTES:
        return

    log_dir = os.path.dirname(log_file_path)
    archive_dir = os.path.join(log_dir, 'archive')
    os.makedirs(archive_dir, exist_ok=True)

    from datetime import datetime, timezone
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    archive_path = os.path.join(archive_dir, f'Log-{stamp}.md')
    suffix = 1
    while os.path.exists(archive_path):
        archive_path = os.path.join(archive_dir, f'Log-{stamp}-{suffix}.md')
        suffix += 1

    os.rename(log_file_path, archive_path)
    archive_name = os.path.basename(archive_path)
    with open(log_file_path, 'w', encoding='utf-8') as f:
        f.write(
            f"# Log\n\nRotated {stamp} (prior entries exceeded {MAX_LOG_BYTES} bytes). "
            f"Prior entries: [{archive_name}](archive/{archive_name}).\n"
        )
