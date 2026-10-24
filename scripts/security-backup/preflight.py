#!/usr/bin/env python3
"""Offline validation only. Never connects, exports, uploads or reads secret bytes."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys

TOOLS = ("pg_dump", "pg_restore", "psql", "age", "rclone")

def validate(config, which=shutil.which):
    errors = []
    if not isinstance(config, dict):
        return ["config: expected JSON object"]
    if config.get("schema_version") != 1:
        errors.append("schema_version: expected 1")
    if not re.fullmatch(r"[a-z]{20}", str(config.get("project_ref", ""))):
        errors.append("project_ref: explicit project reference required")
    # A public URL is not proof of the source. An operator must verify the DB/storage pair.
    for flag in ("source_verified", "auth_recovery_reviewed", "destinations_independent_verified", "external_alerts_verified"):
        if config.get(flag) is not True:
            errors.append(flag + ": operator verification required")
    if config.get("postgres_major") != 17:
        errors.append("postgres_major: this preparation targets PostgreSQL 17; review compatibility")
    for key in ("database_service", "storage_url", "age_recipient", "alert_monitor_name"):
        value = config.get(key)
        if not isinstance(value, str) or not value.strip() or "REPLACE" in value:
            errors.append(key + ": explicit non-placeholder value required")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", str(config.get("database_service", ""))):
        errors.append("database_service: use a libpq service name, never a credential URL")
    ref = str(config.get("project_ref", ""))
    if config.get("storage_url") != "https://" + ref + ".supabase.co":
        errors.append("storage_url: must match explicitly selected project")
    if not str(config.get("age_recipient", "")).startswith("age1"):
        errors.append("age_recipient: reviewed age public recipient required")
    for key in ("pg_service_file", "pgpass_file", "storage_key_file", "rclone_config_file"):
        raw = config.get(key)
        if not isinstance(raw, str) or not Path(raw).is_absolute():
            errors.append(key + ": absolute private file path required")
            continue
        path = Path(raw)
        try:
            info = path.lstat()
            if not stat.S_ISREG(info.st_mode) or path.is_symlink():
                errors.append(key + ": must be a regular non-symlink file")
            elif info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
                errors.append(key + ": must be owned by current user with mode 0600 or stricter")
            elif info.st_size == 0:
                errors.append(key + ": must not be empty")
        except OSError:
            errors.append(key + ": private file unavailable")
    root = config.get("work_directory")
    if not isinstance(root, str) or not Path(root).is_absolute():
        errors.append("work_directory: absolute private directory required")
    else:
        try:
            info = Path(root).lstat()
            if not stat.S_ISDIR(info.st_mode) or Path(root).is_symlink() or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
                errors.append("work_directory: must be owned by current user, non-symlink, mode 0700 or stricter")
        except OSError:
            errors.append("work_directory: private directory unavailable")
    destinations = config.get("destinations")
    if not isinstance(destinations, list) or len(destinations) != 2:
        errors.append("destinations: exactly two remote destinations required")
    else:
        remotes = []
        for dest in destinations:
            remote = dest.get("remote", "") if isinstance(dest, dict) else ""
            if not isinstance(remote, str) or not re.fullmatch(r"[A-Za-z0-9_-]+:[A-Za-z0-9_/-]+", remote) or ".." in remote.split(":", 1)[-1].split("/") or "REPLACE" in remote:
                errors.append("destinations: explicit safe rclone remote:path required")
            else:
                remotes.append(remote.split(":", 1)[0])
        if len(set(remotes)) != 2:
            errors.append("destinations: use distinct remote configurations; verify separate accounts manually")
        if not any(isinstance(d, dict) and d.get("immutable_retention_verified") is True for d in destinations):
            errors.append("destinations: protected retention must be verified for at least one destination")
    for tool in TOOLS:
        if not which(tool):
            errors.append("tool: " + tool + " unavailable")
    return errors

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--run", action="store_true", help="always blocked: operational exporter not implemented")
    args = parser.parse_args(argv)
    if args.run:
        print("BLOCKED: no operational backup runner exists; no export or upload attempted.")
        return 3
    try:
        config = json.loads(Path(args.config).read_text())
    except (OSError, ValueError):
        print("BLOCKED: configuration could not be loaded; values omitted.")
        return 2
    errors = validate(config)
    for error in errors:
        print("BLOCKED: " + error)
    print("OFFLINE PREFLIGHT ONLY: no network access, export, encryption, upload or deletion attempted.")
    if not errors:
        print("Configuration shape accepted. Credentials, tool versions, source completeness and recovery remain unverified. NOT an operational backup.")
    return 2 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
