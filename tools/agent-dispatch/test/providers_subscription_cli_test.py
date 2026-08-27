import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))
from providers.subscription_cli import run_provider


class SubscriptionCliTests(unittest.TestCase):
    def setUp(self):
        self.route = {"provider": "subscription-cli", "model": "configured"}
        self.catalog = {"provider": "subscription-cli", "command": {"executable": "agent"}}

    @patch("providers.subscription_cli.subprocess.run")
    def test_uses_catalog_command_and_task_cannot_replace_it(self, run):
        run.return_value.returncode = 0
        run.return_value.stdout = "ok"
        run.return_value.stderr = ""
        result = run_provider(self.route, "bounded task", {"catalog_route": self.catalog})
        self.assertEqual(result.status, "succeeded")
        self.assertEqual(run.call_args.args[0], ["agent"])

    def test_missing_catalog_configuration_fails_closed(self):
        result = run_provider(self.route, "task", {})
        self.assertEqual(result.failure_class, "CONFIGURATION")

    @patch("providers.subscription_cli.subprocess.run", side_effect=TimeoutError)
    def test_unexpected_timeout_like_failure_does_not_leak_input(self, run):
        with self.assertRaises(TimeoutError):
            run_provider(self.route, "SECRET", {"catalog_route": self.catalog})


if __name__ == "__main__":
    unittest.main()
