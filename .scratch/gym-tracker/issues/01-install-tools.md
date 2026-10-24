# 01: Install the development tools

**What to build:** The user's Windows PC gets the two tools the build needs: Node.js (to build and test the app) and GitHub CLI (so Claude can create the GitHub repository and publish the app). GitHub CLI gets logged in to the user's existing GitHub account. The user is a beginner, so the agent guides them step by step: which installer to download from the official sites, which options to keep, and the exact command to log in. Once the user reports back, the agent verifies the result.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Node.js (current LTS) is installed and `node --version` and `npm --version` work in a new terminal
- [x] GitHub CLI is installed and `gh --version` works
- [x] `gh auth status` shows the user logged in to their GitHub account
- [x] Git commits made by Claude Code can be pushed to GitHub (GitHub CLI's git login helper is set up)
