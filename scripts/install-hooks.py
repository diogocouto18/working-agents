#!/usr/bin/env python3
"""Adds working-agents' Claude Code hooks to ~/.claude/settings.json.
Backs up the original first. Safe to re-run (won't duplicate the block)."""
import json, os, shutil, sys
from pathlib import Path

SETTINGS = os.path.expanduser("~/.claude/settings.json")
# Resolved relative to this script, not a hardcoded clone path — a repo
# checked out anywhere other than ~/workspace/mini-projects/working-agents
# used to get hook commands pointing at a file that doesn't exist.
HOOK_SCRIPT = str((Path(__file__).resolve().parent.parent / "server" / "claude-hook.js"))

EVENTS = {
    "SessionStart": None, "SessionEnd": None,
    "PreToolUse": "*", "PostToolUse": "*",
    "PermissionRequest": None, "Notification": None,
    "Stop": None, "SubagentStart": None, "SubagentStop": None,
}

with open(SETTINGS) as f:
    settings = json.load(f)

if "hooks" in settings and any(k in settings["hooks"] for k in EVENTS):
    print("hooks already present in settings.json — nothing changed.")
    sys.exit(0)

shutil.copy(SETTINGS, SETTINGS + ".bak")
print(f"backed up to {SETTINGS}.bak")

hooks = settings.setdefault("hooks", {})
for event, matcher in EVENTS.items():
    entry = {"hooks": [{
        "type": "command",
        "command": f"node {HOOK_SCRIPT} {event}",
        "timeout": 2,
    }]}
    if matcher:
        entry["matcher"] = matcher
    hooks.setdefault(event, []).append(entry)

with open(SETTINGS, "w") as f:
    json.dump(settings, f, indent=2)
    f.write("\n")

print("done — hooks installed. Restart your active Claude Code sessions to pick them up.")
