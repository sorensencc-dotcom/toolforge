#!/usr/bin/env python3
import os
import sys
import subprocess

# Find the canonical auditor script path relative to this file
script_dir = os.path.dirname(os.path.abspath(__file__))
canonical_script = os.path.join(script_dir, "skills", "skill-security-auditor", "src", "skill_security_auditor.py")

if __name__ == "__main__":
    if not os.path.exists(canonical_script):
        print(f"Error: Canonical security auditor not found at '{canonical_script}'", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Run canonical script using the current Python interpreter
        # Pass all command line arguments
        result = subprocess.run([sys.executable, canonical_script] + sys.argv[1:])
        sys.exit(result.returncode)
    except Exception as e:
        print(f"Error executing security auditor: {e}", file=sys.stderr)
        sys.exit(1)
