# Skill installation

Skill installation lets a developer or autonomous agent resolve, pin, and initialize a skill installation in a target destination directory, writing a deterministic `.toolforge-install.json` metadata receipt.

## Sub-features

- `install-latest` resolves the latest published version of a skill from catalog metadata.
- `install-version` matches against published version tags (falling back to newest release if unmatched).
- `install-destination` ensures the target destination directory exists and isolates the installation receipt.
- `install-receipt` records an installation manifest (`.toolforge-install.json`) with timestamps, skill ID, entrypoint, and runtime.

## How to get to it (user POV)

- Run `toolforge install <skill-name>` in the terminal.
- Run `toolforge install <skill-name> --version <version>` to install an explicit version.
- Run `toolforge install <skill-name> --destination <path>` to install into a custom folder.
- Choose `Install` on a skill detail card in the Marketplace web UI.

## Driving it with control-marketplace

Preconditions:

- Marketplace doctor passes (`node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs doctor`).
- API server is running at `--api-url` with target skill registered.
- A disposable target directory exists under `evidence/verify-toolforge-marketplace/<run-id>/installed-skills/`.

- **Install skill via CLI.** Install skill into target directory:
  Run `node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs cli -- install <skill-name> --destination "evidence/verify-toolforge-marketplace/<run-id>/installed-skills" --api-url <url>`.
  Exit code `0` and console outputs `✓ Successfully installed <skill-name> v<version>`.

- **Confirm installation receipt.** Inspect the metadata receipt written to the destination:
  Read `evidence/verify-toolforge-marketplace/<run-id>/installed-skills/.toolforge-install.json`.
  Contains:
  ```json
  {
    "skill": "<skill-name>",
    "skillId": "<uuid>",
    "version": "<version>",
    "installedAt": "<timestamp>",
    "entrypoint": "<path>",
    "runtime": "node"
  }
  ```

- **Verify pinned version installation.** Install a specific older version:
  Run `node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs cli -- install <skill-name> --version 1.0.0 --destination "..." --api-url <url>`.
  The receipt `.toolforge-install.json` reflects `"version": "1.0.0"`.

## Gotchas

- If a requested skill name does not exist in the catalog, `toolforge install` exits 1 with `✗ Skill not found: <skill-name>`.
- If an unmatched `--version` string is passed, the CLI falls back to the newest release (`versions[0]`) rather than throwing an error.
- The target destination directory defaults to `./skills`. Always specify `--destination` in automated verification runs to avoid writing untracked files into the working tree.
- The installation receipt `.toolforge-install.json` is overwritten on reinstall: ensure your assertions inspect the file immediately following the specific command invocation.
- In the React Web UI (`SkillDetail.jsx`), the Install button performs a localized state simulation (`setTimeout`) and does not connect to backend installation or filesystem receipts.
