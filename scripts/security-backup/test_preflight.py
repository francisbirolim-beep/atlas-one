import contextlib
import copy
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
import preflight

class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        os.chmod(self.root, 0o700)
        self.config = {
            "schema_version": 1, "project_ref": "a"*20, "postgres_major": 17,
            "source_verified": True, "auth_recovery_reviewed": True,
            "destinations_independent_verified": True, "external_alerts_verified": True,
            "database_service": "synthetic_test", "storage_url": "https://"+"a"*20+".supabase.co",
            "age_recipient": "age1synthetic", "alert_monitor_name": "synthetic-monitor",
            "work_directory": str(self.root),
            "destinations": [{"remote": "first:backups", "immutable_retention_verified": True}, {"remote": "second:backups"}]
        }
        for key in ("pg_service_file", "pgpass_file", "storage_key_file", "rclone_config_file"):
            f = self.root/key
            f.write_text("SYNTHETIC-SECRET-NEVER-PRINT")
            f.chmod(0o600)
            self.config[key] = str(f)
    def tearDown(self):
        self.temp.cleanup()
    def test_shape_acceptance_is_offline_only(self):
        self.assertEqual(preflight.validate(self.config, which=lambda _: "/synthetic/tool"), [])
    def test_missing_tools_fail(self):
        self.assertEqual(sum(e.startswith("tool:") for e in preflight.validate(self.config, which=lambda _: None)), 5)
    def test_same_remote_rejected(self):
        self.config["destinations"][1]["remote"] = "first:other-folder"
        self.assertTrue(any("distinct remote" in e for e in preflight.validate(self.config)))
    def test_secret_permissions_and_symlink_rejected(self):
        f = Path(self.config["pgpass_file"])
        f.chmod(0o644)
        self.assertTrue(any("pgpass_file: must be owned" in e for e in preflight.validate(self.config)))
        f.unlink()
        f.symlink_to(Path(self.config["storage_key_file"]))
        self.assertTrue(any("pgpass_file: must be a regular" in e for e in preflight.validate(self.config)))
    def test_mismatched_source_rejected(self):
        self.config["storage_url"] = "https://wrong.example"
        self.assertTrue(any("must match" in e for e in preflight.validate(self.config)))
    def test_missing_attestations_fail(self):
        self.config["auth_recovery_reviewed"] = False
        self.assertTrue(any("auth_recovery_reviewed" in e for e in preflight.validate(self.config)))
    def test_run_is_unconditionally_blocked(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            result = preflight.main(["--config", "/does/not/exist", "--run"])
        self.assertEqual(result, 3)
        self.assertNotIn("SYNTHETIC-SECRET", out.getvalue())
    def test_invalid_json_does_not_echo_contents(self):
        f = self.root/"bad.json"
        f.write_text("SYNTHETIC-SECRET-NEVER-PRINT")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            result = preflight.main(["--config", str(f)])
        self.assertEqual(result, 2)
        self.assertNotIn("SYNTHETIC-SECRET", out.getvalue())
    def test_example_fails_closed(self):
        sample = json.loads(Path(__file__).with_name("config.example.json").read_text())
        self.assertTrue(preflight.validate(sample, which=lambda _: "/synthetic/tool"))

if __name__ == "__main__":
    unittest.main()
