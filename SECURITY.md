# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report privately through GitHub's private vulnerability reporting:
<https://github.com/diogocouto18/working-agents/security/advisories/new>

Include what you found, how to reproduce it, and the affected version or
commit. This is a small personal project, so expect a first response within
about a week.

## Scope

working-agents runs a local server that reads Claude Code session
transcripts and serves a web UI. By default it is meant to be bound to
localhost only. Reports about exposing it on a network, path handling, or
transcript parsing are in scope.

## Supported versions

Only the latest commit on `master` is supported.
