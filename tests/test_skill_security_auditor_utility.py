import os
import sys
import unittest
from unittest.mock import patch
import io

base_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(base_dir, ".."))
utility_path = os.path.join(root_dir, "utilities", "skill-security-auditor.py")

class TestSkillSecurityAuditorUtility(unittest.TestCase):

    @patch('subprocess.run')
    def test_subprocess_exception_handling(self, mock_run):
        mock_run.side_effect = Exception("Mocked subprocess failure")

        with patch('os.path.exists', return_value=True):
            with patch('sys.stderr', new=io.StringIO()) as mock_stderr:
                with patch('sys.argv', ['skill-security-auditor.py']):
                    with self.assertRaises(SystemExit) as cm:
                        with open(utility_path, 'r') as f:
                            exec(f.read(), {'__name__': '__main__', '__file__': utility_path})

                    self.assertEqual(cm.exception.code, 1)
                    self.assertIn("Error executing security auditor: Mocked subprocess failure", mock_stderr.getvalue())

if __name__ == '__main__':
    unittest.main()
