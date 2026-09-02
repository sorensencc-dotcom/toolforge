import sys
import unittest
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from providers.openrouter import run_provider


class OpenRouterTests(unittest.TestCase):
    def setUp(self):
        self.route = {"provider": "openrouter", "model": "free-model"}

    def test_missing_key_fails_closed(self):
        with patch.dict("os.environ", {}, clear=True):
            self.assertEqual(run_provider(self.route, "secret", {}).failure_class, "CONFIGURATION")

    def test_key_is_not_returned_in_result(self):
        seen = {}
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"choices":[{"message":{"content":"done"}}]}'
        def request(req, timeout):
            seen["auth"] = req.get_header("Authorization")
            return Response()
        with patch.dict("os.environ", {"OPENROUTER_API_KEY": "SECRET"}, clear=False):
            result = run_provider(self.route, "bounded", {}, request)
        self.assertEqual(result.status, "succeeded")
        self.assertEqual(seen["auth"], "Bearer SECRET")
        self.assertNotIn("SECRET", repr(result))


if __name__ == "__main__": unittest.main()
