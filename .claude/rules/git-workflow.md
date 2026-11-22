# Git workflow: always start from an up-to-date main

Before making any code change (bug fix, new feature, refactor, design or config change):

1. Check for uncommitted work with `git status`. If there is any, stop and ask the user what to do with it. Never discard or stash it silently.
2. Switch to the default branch and pull the latest changes:
   ```
   git checkout main
   git pull --ff-only origin main
   ```
   The default branch is `main`. If a repo uses `master`, use that instead.
3. Create a new branch from it before editing any file:
   - Bug fix: `fix/<short-description>`
   - New feature: `feat/<short-description>`
   - Other changes: `chore/<short-description>`

Rules:
- Never commit or make changes directly on `main`/`master`.
- One branch per fix or feature. Don't pile unrelated changes onto an existing branch.
- Don't stack a new branch on another unmerged feature branch unless the user asks for it. If you do stack branches, tell the user that the pull requests must be merged in order and each one retargeted to `main`.
- Open pull requests against `main`.
