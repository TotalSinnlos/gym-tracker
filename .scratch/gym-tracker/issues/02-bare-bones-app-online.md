# 02: Bare-bones app online

**What to build:** A minimal TypeScript web app (a single screen with the app name is enough) that's published to GitHub Pages and installable on the user's Android phone. It opens full screen from its home-screen icon and works with no internet connection. The project is set up with a test runner and one passing example test, and every push to the main branch runs the tests and republishes the app automatically. This ticket sets up the conventions every later ticket builds on.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A public GitHub repository named `gym-tracker` exists, and the local project is pushed to it
- [ ] The app is live at `https://<github-username>.github.io/gym-tracker/`
- [ ] Pushing to main runs the tests and redeploys automatically, and a failing test stops the deploy
- [ ] The app has a web manifest (name, icon, full-screen display) and a service worker that caches all app files
- [ ] Chrome on Android offers to install it, and the installed app opens full screen with its own icon
- [ ] With flight mode on, the installed app still opens
- [ ] The test command runs locally and passes
- [ ] The user has installed it on their phone and confirmed it opens
