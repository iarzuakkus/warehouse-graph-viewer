# AGENTS.md

## Scope

These instructions apply to the entire repository.

## Project Status

This repository is currently being initialized. Do not assume a framework,
language, package manager, or build system until the relevant configuration
files exist.

## Working Guidelines

- Inspect the repository before making changes and follow established patterns.
- Keep changes focused on the user's request; avoid unrelated refactors.
- Preserve existing user changes and never discard work without explicit approval.
- Prefer small, clear, maintainable implementations over unnecessary abstraction.
- Do not add dependencies unless they provide clear value and are required by the task.
- Never commit secrets, credentials, tokens, local environment files, or generated
  artifacts that should remain untracked.
- Update documentation when behavior, setup, or developer workflows change.

## Validation

- Use the scripts defined by the project once its tooling is established.
- Run the most relevant tests, lint checks, type checks, and build commands for
  the files changed.
- If validation cannot be run, clearly state what was not verified and why.
- Do not claim that a check passed unless it was actually executed successfully.

## File and Code Conventions

- Follow repository-local formatting and naming conventions.
- Keep source files cohesive and avoid oversized modules where practical.
- Add comments only when they explain non-obvious intent or constraints.
- Use UTF-8 text files and preserve the existing line-ending convention.
- Prefer configuration and scripts that work consistently across development
  environments.

## Git Hygiene

- Keep commits and diffs narrowly scoped.
- Do not rewrite history, force-push, reset, or remove unrelated files unless the
  user explicitly requests it.
- Before handing off work, review the diff for accidental or generated changes.

## Maintaining This File

When the project stack is selected, update this file with the exact setup,
development, test, lint, type-check, build, and release commands, plus any
architecture-specific constraints agents must follow.
