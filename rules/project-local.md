# AI Repo Local Rules

These rules apply only when working in this repository checkout. Do not install
this file into user-level runtime instruction profiles.

## Project Setup

- Use `mise install` to install the project toolchain.
- Use `mise run setup` to install dependencies and configure Lefthook git hooks.
- Use `mise run pre-commit` to run the local Lefthook pre-commit gate.
