"""Fail on new advisories; reviewed exceptions are version-scoped and expire."""

import json
import subprocess
import sys
from datetime import UTC, datetime
from importlib.metadata import version
from pathlib import Path

root = Path(__file__).resolve().parents[1]
policy = json.loads((root / "audit-policy.json").read_text())
if datetime.now(UTC).date().isoformat() > policy["reviewBy"]:
    sys.exit("Chroma security exception needs review. See audit-policy.json and docs/SECURITY.md.")
if version(policy["package"]) != policy["version"]:
    sys.exit("Chroma version changed. Reassess the security exception before auditing.")
command = [
    sys.executable,
    "-m",
    "pip_audit",
    "-r",
    str(root / "requirements.lock"),
    "--progress-spinner",
    "off",
]
for identifier in policy["ignoredVulnerabilities"]:
    command += ["--ignore-vuln", identifier]
sys.exit(subprocess.call(command, cwd=root))
