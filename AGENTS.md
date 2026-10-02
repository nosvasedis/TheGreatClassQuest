# Agent instructions for managed Codex cloud environments

## Scope

All instructions and standing authorizations in this file apply **only when the agent executes repository work inside a managed Codex cloud execution environment attached to a Codex task**, such as this task's cloud workspace.

Determine applicability from explicit execution-environment metadata identifying the attached environment as managed cloud (for example, the environment status reports `provider: cloud`). A `/workspace` path, a container, or the use of the Codex desktop app alone does not establish this scope. A desktop session using an attached managed cloud executor qualifies; a session executing locally does not.

These instructions do not apply to local CLI, desktop or IDE execution, ordinary CI runners, or other cloud hosts that are not managed Codex task environments. If the environment cannot be positively identified as qualifying, do not apply this file's workflow or standing authorization. Outside this scope, follow the user's current instructions and other applicable repository rules; this file grants no automatic commit, merge, push, or branch-deletion authorization there.

## Complete delivery to main

Within the scope above, the repository owner explicitly requires this default workflow for code changes:

1. Finish the requested work and run the checks appropriate to the change.
2. Fetch the latest `origin/main` and preserve all changes already on it, including work by other agents. Resolve integration conflicts carefully and rerun affected checks after integration.
3. Commit only the changes belonging to your task, with a clear commit message. Do not include unrelated edits, secrets, generated artifacts, or intentionally private files.
4. Integrate the completed work into the local `main` branch and push `main` to `origin`. A task is not delivered merely by pushing a temporary branch or opening a pull request. Use a normal push; never force-push `main` or discard another agent's commits. If the remote moves before the push, fetch and integrate its new commits, verify the result, then retry.
5. Verify the pushed commit is present on `origin/main`. Only after successful delivery, delete temporary local and remote branches created for this task, once their commits are contained in `main`. Never delete `main`, another agent's active branch, or unmerged work.
6. Report the resulting commit and the checks performed. If a repository rule, permission, authentication failure, or required check blocks delivery, report the concrete blocker; do not silently substitute a push to another branch.

Within that cloud-only scope, this workflow is already authorized by the owner. Do not ask for the same commit, merge, push, or merged task-branch cleanup approval again. Explicit instructions in the current conversation take precedence: for example, a request to explain without changing files, to keep work local, or to use a different target branch overrides this default. Read-only and planning requests do not authorize new code changes. Separate deployment actions beyond pushing `main` are not implied by this workflow.

Keep this `AGENTS.md` tracked so these scoped instructions survive fresh clones and are available to future agents working in qualifying managed cloud environments.
