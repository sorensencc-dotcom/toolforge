import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "src" / "skill_security_auditor.py"
spec = importlib.util.spec_from_file_location("skill_security_auditor", MODULE_PATH)
auditor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auditor)


class DeserialRuleTests(unittest.TestCase):
    def test_js_yaml_json_schema_is_not_reported_as_python_unsafe_yaml(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = Path(tmp) / "skill"
            src = skill / "src"
            src.mkdir(parents=True)
            (src / "sync.mjs").write_text(
                "import yaml from 'js-yaml';\n"
                "const fm = yaml.load(raw, { schema: yaml.JSON_SCHEMA });\n",
                encoding="utf-8",
            )

            report = auditor.scan_skill(skill)

        self.assertEqual([], [finding for finding in report.findings if finding.category == "DESERIAL"])

    def test_python_yaml_load_is_still_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = Path(tmp) / "skill"
            src = skill / "src"
            src.mkdir(parents=True)
            (src / "parse.py").write_text("import yaml\nvalue = yaml.load(raw)\n", encoding="utf-8")

            report = auditor.scan_skill(skill)

        self.assertTrue(any(finding.category == "DESERIAL" for finding in report.findings))

    def test_safe_yaml_does_not_hide_other_deserialization(self):
        for source in [
            "yaml.load(raw, { schema: yaml.JSON_SCHEMA }); yaml.load(other);",
            "yaml.load(raw, { schema: yaml.JSON_SCHEMA }); pickle.loads(other);",
            "yaml.load(raw, { schema: yaml.JSON_SCHEMA }); marshal.loads(other);",
            "yaml.load(raw); // schema: yaml.JSON_SCHEMA",
            "yaml.load(raw, { schema: yaml.JSON_SCHEMA, ...options });",
            "yaml.load(raw, { schema: yaml.JSON_SCHEMA_CUSTOM });",
            "yaml.unsafe_load(raw, { schema: yaml.JSON_SCHEMA });",
        ]:
            with self.subTest(source=source), tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "parse.mjs"
                path.write_text(source, encoding="utf-8")
                report = auditor.AuditReport(skill_name="fixture", skill_path=str(tmp))
                auditor.scan_file_code(path, report)
                self.assertTrue(any(finding.category == "DESERIAL" for finding in report.findings))


if __name__ == "__main__":
    unittest.main()
