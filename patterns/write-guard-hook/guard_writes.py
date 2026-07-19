#!/usr/bin/env python3
"""
write-guard — a config-driven PreToolUse hook for Claude Code.

Blocks file writes to protected paths. Protected paths live in a config file
(`.write-guard.json`), not in this script, so the script never needs editing.

Usage as a hook (reads the PreToolUse payload on stdin):
    guard_writes.py

Usage from the shell, for testing your config:
    guard_writes.py --check legal/msa.md
    guard_writes.py --list
    guard_writes.py --selftest

Exit codes follow the Claude Code hook contract:
    0  allow (stdout is parsed as an optional JSON decision)
    2  block — stderr is fed back to the model as an error

Docs: https://code.claude.com/docs/en/hooks
Stdlib only. Python 3.8+.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

CONFIG_NAMES = (".write-guard.json", ".claude/write-guard.json")
DEFAULT_REASON = "protected by .write-guard.json"

# Tools whose tool_input carries a target file path.
PATH_KEYS = ("file_path", "notebook_path", "path")


# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

class Config:
    def __init__(self, root: Path, data: Dict[str, Any], source: Optional[Path]):
        self.root = root
        self.source = source
        self.mode = str(data.get("mode", "block")).lower()
        self.rules: List[Tuple[str, str]] = []
        self.allow: List[str] = [str(p) for p in data.get("allow", [])]

        for entry in data.get("protected", []):
            if isinstance(entry, str):
                self.rules.append((entry, DEFAULT_REASON))
            elif isinstance(entry, dict) and entry.get("pattern"):
                self.rules.append(
                    (str(entry["pattern"]), str(entry.get("reason", DEFAULT_REASON)))
                )
            else:
                raise ValueError(
                    f"invalid entry in 'protected': {entry!r} "
                    "(expected a string or an object with a 'pattern' key)"
                )

        if self.mode not in ("block", "warn"):
            raise ValueError(f"invalid mode {self.mode!r} (expected 'block' or 'warn')")


def find_config(start: Path) -> Optional[Path]:
    """Walk up from `start` looking for a config file. Env var wins."""
    override = os.environ.get("WRITE_GUARD_CONFIG")
    if override:
        candidate = Path(override).expanduser()
        return candidate if candidate.is_file() else None

    for directory in [start, *start.parents]:
        for name in CONFIG_NAMES:
            candidate = directory / name
            if candidate.is_file():
                return candidate
    return None


def load_config(start: Path) -> Optional[Config]:
    path = find_config(start)
    if path is None:
        return None
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    # Project root is the directory holding the config, or its parent for
    # `.claude/write-guard.json`.
    root = path.parent.parent if path.parent.name == ".claude" else path.parent
    return Config(root=root, data=data, source=path)


# --------------------------------------------------------------------------
# Matching
# --------------------------------------------------------------------------

def relativize(target: str, root: Path) -> str:
    """Return `target` relative to `root` with forward slashes, if possible."""
    candidate = Path(target).expanduser()
    if not candidate.is_absolute():
        candidate = (root / candidate)
    try:
        rel = candidate.resolve().relative_to(root.resolve())
        return rel.as_posix()
    except (ValueError, OSError):
        # Outside the project root — match against the absolute path instead.
        return candidate.as_posix()


def matches(rel_path: str, pattern: str) -> bool:
    """
    Match a project-relative path against a pattern.

    `*` matches across directory separators, so `legal/*` and `legal/**` both
    cover nested files. A pattern ending in `/` matches everything beneath it.
    A pattern with no `/` also matches on basename, so `*.pem` catches
    `certs/key.pem`.
    """
    if pattern.endswith("/"):
        return rel_path == pattern.rstrip("/") or rel_path.startswith(pattern)
    if fnmatch.fnmatchcase(rel_path, pattern):
        return True
    if "/" not in pattern and fnmatch.fnmatchcase(Path(rel_path).name, pattern):
        return True
    # Bare directory name, e.g. "legal" should cover "legal/msa.md".
    return rel_path.startswith(pattern.rstrip("/") + "/")


def evaluate(target: str, config: Config) -> Optional[Tuple[str, str]]:
    """Return (pattern, reason) if `target` is protected, else None."""
    rel = relativize(target, config.root)

    for allowed in config.allow:
        if matches(rel, allowed):
            return None

    for pattern, reason in config.rules:
        if matches(rel, pattern):
            return pattern, reason
    return None


# --------------------------------------------------------------------------
# Hook entry point
# --------------------------------------------------------------------------

def extract_path(payload: Dict[str, Any]) -> str:
    tool_input = payload.get("tool_input") or {}
    for key in PATH_KEYS:
        value = tool_input.get(key)
        if value:
            return str(value)
    return ""


def run_hook() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError) as exc:
        print(f"write-guard: could not parse hook payload: {exc}", file=sys.stderr)
        return 1  # non-blocking error; do not wedge the session

    target = extract_path(payload)
    if not target:
        return 0  # nothing path-shaped to guard

    start = Path(payload.get("cwd") or os.getcwd())
    try:
        config = load_config(start)
    except (json.JSONDecodeError, ValueError, OSError) as exc:
        print(f"write-guard: config error: {exc}", file=sys.stderr)
        return 1  # non-blocking; a broken config must not block all writes

    if config is None:
        print(
            "write-guard: no .write-guard.json found; allowing all writes.",
            file=sys.stderr,
        )
        return 0

    hit = evaluate(target, config)
    if hit is None:
        return 0

    pattern, reason = hit
    tool = payload.get("tool_name", "write")
    warning = config.mode == "warn"
    headline = (
        f"WARNING: {tool} to '{target}' touches a protected path (mode: warn)."
        if warning
        else f"BLOCKED: {tool} to '{target}' is not permitted."
    )
    message = (
        f"{headline}\n"
        f"Matched protected pattern: {pattern!r}\n"
        f"Reason: {reason}\n"
        f"Config: {config.source}\n"
        f"If this change is intended, ask the human who owns this repository to "
        f"make it, or to amend the config."
    )

    print(message, file=sys.stderr)
    return 0 if warning else 2


# --------------------------------------------------------------------------
# CLI helpers
# --------------------------------------------------------------------------

def run_check(target: str) -> int:
    config = load_config(Path.cwd())
    if config is None:
        print("no config found", file=sys.stderr)
        return 1
    hit = evaluate(target, config)
    if hit is None:
        print(f"ALLOW  {target}")
        return 0
    pattern, reason = hit
    print(f"BLOCK  {target}\n       pattern: {pattern}\n       reason:  {reason}")
    return 2


def run_list() -> int:
    config = load_config(Path.cwd())
    if config is None:
        print("no config found", file=sys.stderr)
        return 1
    print(f"config: {config.source}")
    print(f"root:   {config.root}")
    print(f"mode:   {config.mode}")
    print("protected:")
    for pattern, reason in config.rules:
        print(f"  {pattern:<32} {reason}")
    if config.allow:
        print("allow:")
        for pattern in config.allow:
            print(f"  {pattern}")
    return 0


def run_selftest() -> int:
    """Match-logic tests with no config file and no filesystem dependency."""
    cases = [
        # (path, pattern, expected)
        ("legal/msa.md", "legal/", True),
        ("legal/sub/deep.md", "legal/", True),
        ("legal", "legal/", True),
        ("legalese/notes.md", "legal/", False),
        ("legal/msa.md", "legal", True),
        ("docs/decisions.md", "docs/decisions.md", True),
        ("docs/decisions.md", "docs/other.md", False),
        ("certs/key.pem", "*.pem", True),
        ("key.pem", "*.pem", True),
        ("certs/key.pub", "*.pem", False),
        ("infra/prod/main.tf", "infra/prod/**", True),
        ("infra/dev/main.tf", "infra/prod/**", False),
        (".env.production", ".env*", True),
        ("src/app.ts", "legal/", False),
    ]
    failures = 0
    for path, pattern, expected in cases:
        actual = matches(path, pattern)
        status = "ok  " if actual == expected else "FAIL"
        if actual != expected:
            failures += 1
        print(f"{status} matches({path!r}, {pattern!r}) -> {actual} (want {expected})")

    # Allow-list precedence, exercised through evaluate().
    config = Config(
        root=Path("/project"),
        data={
            "protected": [{"pattern": "legal/", "reason": "counsel only"}],
            "allow": ["legal/README.md"],
        },
        source=None,
    )
    checks = [("legal/msa.md", True), ("legal/README.md", False)]
    for path, should_block in checks:
        blocked = evaluate(path, config) is not None
        status = "ok  " if blocked == should_block else "FAIL"
        if blocked != should_block:
            failures += 1
        print(f"{status} evaluate({path!r}) blocked={blocked} (want {should_block})")

    print(f"\n{'FAILED' if failures else 'PASSED'} — {failures} failure(s)")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="guard_writes.py",
        description="Config-driven PreToolUse write guard for Claude Code.",
    )
    parser.add_argument("--check", metavar="PATH", help="test one path against the config")
    parser.add_argument("--list", action="store_true", help="print the active config")
    parser.add_argument("--selftest", action="store_true", help="run match-logic tests")
    args = parser.parse_args()

    if args.selftest:
        return run_selftest()
    if args.list:
        return run_list()
    if args.check:
        return run_check(args.check)
    return run_hook()


if __name__ == "__main__":
    sys.exit(main())
