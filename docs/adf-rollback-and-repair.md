# ADF Rollback And Repair

## Repair

`adf repair` rebuilds missing or broken paths listed in `./.adf/manifest.json`.

It does not claim new ownership over unknown files.

It also does not remove currently managed paths that are outside the manifest install mode.

`adf repair --dry-run` previews repair work without rewriting `./.adf/payload/.generated`.

## Rollback

`adf rollback latest`

or

`adf rollback <backup-id>`

restores the last successful managed snapshot from `./.adf/backups/`.

Before restoring, ADF creates a `pre-rollback:<backup-id>` snapshot of the current managed state so you can recover if rollback is interrupted.

## Guarantees

- rollback is local to the repo
- backups contain only managed targets and manifest state
- unmanaged content is not intentionally modified
- manifest is restored as part of the snapshot

## Safety Notes

- rollback is not atomic; commit or stash unrelated work before using it
- if restore fails mid-run, use the latest `pre-rollback:*` backup to recover the prior managed state
