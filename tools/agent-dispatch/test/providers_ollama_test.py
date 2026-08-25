import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from providers.ollama import run_provider


class OllamaTests(unittest.TestCase):
    def setUp(self):
        self.route = {"provider": "ollama", "model": "local-model"}

    def test_missing_endpoint_fails_closed(self):
        self.assertEqual(run_provider(self.route, "secret", {}).failure_class, "CONFIGURATION")

    def test_success_uses_configured_endpoint_and_redacts_nothing_sensitive(self):
        seen = {}
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"choices":[{"message":{"content":"done"}}]}'
        def request(req, timeout):
            seen["url"] = req.full_url
            return Response()
        result = run_provider(self.route, "bounded", {"base_url": "http://127.0.0.1:11434/v1"}, request)
        self.assertEqual(result.status, "succeeded")
        self.assertEqual(seen["url"], "http://127.0.0.1:11434/v1/chat/completions")
        self.assertNotIn("secret", result.output)


if __name__ == "__main__": unittest.main()
