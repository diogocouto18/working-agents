#!/usr/bin/env python3
"""Adds working-agents' Claude Code hooks to ~/.claude/settings.json.
Backs up the original first. Safe to re-run (won't duplicate the block)."""
import json, os, shutil, sys

SETTINGS = os.path.expanduser("~/.claude/settings.json")
HOOK_SCRIPT = os.path.expanduser(
    "~/workspace/mini-projects/working-agents/server/claude-hook.js"
)

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
