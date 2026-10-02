# Repository instructions for agents

## Complete delivery to main

The repository owner explicitly requires this default workflow for code changes:

1. Finish the requested work and run the checks appropriate to the change.
2. Fetch the latest `origin/main` and preserve all changes already on it, including work by other agents. Resolve integration conflicts carefully and rerun affected checks after integration.
3. Commit only the changes belonging to your task, with a clear commit message. Do not include unrelated edits, secrets, generated artifacts, or intentionally private files.
4. Integrate the completed work into the local `main` branch and push `main` to `origin`. A task is not delivered merely by pushing a temporary branch or opening a pull request. Use a normal push; never force-push `main` or discard another agent's commits. If the remote moves before the push, fetch and integrate its new commits, verify the result, then retry.
5. Verify the pushed commit is present on `origin/main`. Only after successful delivery, delete temporary local and remote branches created for this task, once their commits are contained in `main`. Never delete `main`, another agent's active branch, or unmerged work.
6. Report the resulting commit and the checks performed. If a repository rule, permission, authentication failure, or required check blocks delivery, report the concrete blocker; do not silently substitute a push to another branch.

This workflow is already authorized by the owner. Do not ask for the same commit, merge, push, or merged task-branch cleanup approval again. Explicit instructions in the current conversation take precedence: for example, a request to explain without changing files, to keep work local, or to use a different target branch overrides this default. Read-only and planning requests do not authorize new code changes. Separate deployment actions beyond pushing `main` are not implied by this workflow.

Keep this `AGENTS.md` tracked so these instructions survive fresh clones and are available to future agents.
