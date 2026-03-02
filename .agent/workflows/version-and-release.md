---
description: how to commit changes with version bump and release
---

After making any code changes to the project, follow these steps to commit, version, and release:

// turbo-all

1. Update `CHANGELOG.md` at the root of the project. Add a new `## [X.Y.Z] - YYYY-MM-DD` section at the top (below the header) with today's date. Follow **Semantic Versioning** rules to determine which number to increment:
   - **Patch** (3rd number, e.g. `1.2.3 → 1.2.4`): Only bug fixes, no new functionality.
   - **Minor** (2nd number, e.g. `1.2.3 → 1.3.0`): New features added (reset patch to 0).
   - **Major** (1st number, e.g. `1.2.3 → 2.0.0`): **Only when explicitly requested by the user** (reset minor and patch to 0).
   - If a session includes both fixes and features, use the **Minor** bump.
   List all changes under `### Added`, `### Changed`, and/or `### Fixed` subsections as appropriate.

2. Update the version badge in `web/src/components/Navbar.tsx`. Find the span containing the version string (e.g. `v1.0.0`) and update it to match the new version.

3. Stage and commit everything together in a single git commit:
   ```
   git add .
   git commit -m "vX.Y.Z: <short summary of changes>"
   ```

4. Create and push the new git tag to trigger the GitHub Actions release workflow:
   ```
   git tag vX.Y.Z
   git push origin master
   git push origin vX.Y.Z
   ```

> **Note:** The `release.yml` GitHub Actions workflow listens for `v*.*.*` tags and automatically creates a GitHub Release with auto-generated notes. Always push the tag after the commit so the release links to the correct commit.
