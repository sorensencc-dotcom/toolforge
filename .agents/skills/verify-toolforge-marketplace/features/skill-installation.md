# Skill installation

Skill installation lets a developer or autonomous agent download, pin, and install a skill package into a target destination directory, writing a deterministic `.toolforge-install.json` metadata receipt.

## Sub-features

- `install-latest` resolves the latest published version of a skill and installs it.
- `install-version` pins and downloads an exact SemVer release version specified by the user.
- `install-destination` places skill files into a custom target directory.
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
- The target destination directory defaults to `./skills`. Always specify `--destination` in automated verification runs to avoid writing untracked files into the working tree.
- The installation receipt `.toolforge-install.json` is overwritten on reinstall: ensure your assertions inspect the file immediately following the specific command invocation.
