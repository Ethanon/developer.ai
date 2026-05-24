# Install developer.ai on Your Project

The fastest way to get the agent kit running on your project is to let the installer agent do it for you. A short Q&A walks you through your stack, your conventions, and your repo identity; the installer then writes the calibrated files into your target repo on a new branch.

## What you need before starting

1. **Claude Code installed locally.** This kit runs inside Claude Code.
2. **A Claude OAuth token.** Run `claude setup-token` if you don't already have one set up.
3. **The path to your target repo on disk.** The installer writes into it.
4. **Your target repo's GitHub identity** (`owner/name`). The installer fills it into the agent files and workflows.
5. **Permission to push a new branch to that repo.** The installer commits on a fresh branch; you merge later.

## Steps

1. **Clone this repo** somewhere local:

   ```bash
   git clone https://github.com/Ethanon/developer.ai.git
   cd developer.ai
   ```

2. **Open Claude Code** in that folder.

3. **Run the installer:**

   ```
   /install
   ```

   (Or, equivalently, ask in plain English: "set this up on my project".)

4. **Answer the wizard.** The installer asks ~19 questions across five groups:
   - About your project (what it does, who uses it, scale)
   - About your stack (language, frontend, database, auth, deployment, CI)
   - About your conventions (naming style, things you don't do)
   - About your review fleet (which optional agents to include)
   - About your GitHub repo (owner, name, default branch)

   You can revise any answer before confirming.

5. **Review the plan.** The installer prints a one-paragraph summary of what it's about to do ("I'll copy 14 agents, 5 skills, 3 workflows..."). If anything looks wrong, say so; otherwise confirm.

6. **Wait for the install to finish.** The installer copies files, edits placeholders, and commits everything on a new branch (`chore/install-developer-ai`) in your target repo. Takes a minute or two.

7. **Add the `CLAUDE_CODE_OAUTH_TOKEN` secret to your repo.** The installer's "what's next" output tells you the exact URL. Paste your OAuth token there.

8. **Open a small test PR** in your target repo. The agents should fire automatically. If they don't, the most common cause is a missing secret (step 7).

## What the installer does

The installer reads inline tags in every kit file and either keeps, strips, or customizes each section based on your wizard answers. Two examples:

- If you said "no frontend," the installer skips Carl entirely AND strips all frontend-only categories from Alice and Bob. The files in your target repo will only contain rules that apply to a backend-only project.
- If you said "uses Auth0" (instead of the kit's self-hosted default), the installer keeps the cookie-policy rules (those still apply) but swaps the auth-store paragraph in `docs/SECURITY.md` to reflect your choice.

The kit ships with strong opinions as defaults. The installer's job is to relax those opinions where your project disagrees, not to ask you to fill in 47 blank slots.

## After the install

Read `docs/CALIBRATE.md` in your target repo. It walks you through the remaining tuning steps:

- Reading the templates the installer just created and editing further if needed.
- Opening that first test PR and watching the agents fire.
- Iterating on the templates as the agents produce findings that are noisy or off-target.

## Manual install (if you don't want to use the installer)

If you'd rather copy files by hand (for example, you want full control over what lands in your repo), see `ADAPTING.md`. The manual flow gives you visibility into every file before it lands.

## When the installer is the wrong call

- **You're not in a git repo on the target side.** The installer wants to commit; if your target isn't a git repo, run `git init` first or use the manual install.
- **You want to mix-and-match agents from multiple kits.** The installer assumes a clean install; merging with another agent set is easier to do manually.
- **You don't fully trust the installer to edit your repo.** Use the manual install; everything the installer does is documented in `ADAPTING.md`.

## Troubleshooting

- **"I'm not in a developer.ai folder."** The installer refuses to run from the wrong directory. `cd` into the freshly-cloned developer.ai folder and try again.
- **"Target repo has uncommitted changes."** Commit, stash, or clean your target repo first. The installer won't overwrite work in progress.
- **"CLAUDE_CODE_OAUTH_TOKEN not set."** Run `claude setup-token` and add the result to your target repo's GitHub Secrets.
- **The agents post but post nothing useful.** Read `docs/CALIBRATE.md`. The templates are calibrated to your wizard answers; if the answers were sparse, the templates will be too. The fix is editing the templates with more detail, not re-running the installer.
