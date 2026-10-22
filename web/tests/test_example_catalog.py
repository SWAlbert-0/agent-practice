"""验证新示例的自动发现；仅解析临时源码，不导入项目业务模块。"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "generate_sources", Path(__file__).resolve().parents[1] / "generate_sources.py"
)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class ExampleCatalogTest(unittest.TestCase):
    def test_new_example_is_discovered_without_frontend_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "examples").mkdir()
            (root / "web").mkdir()
            (root / "examples/new_demo.py").write_text(
                'def main():\n    """New example"""\n    pass\n\n'
                'if __name__ == "__main__":\n    main()\n', encoding="utf-8"
            )
            with patch.object(generator, "PROJECT_ROOT", root), \
                    patch.object(generator, "WEB_ROOT", root / "web"), \
                    patch.object(generator, "SOURCE_FILES", ()):
                sources = generator.generate()
            catalog = json.loads((root / "web/examples.json").read_text(encoding="utf-8"))
            self.assertIn("examples/new_demo.py", sources)
            self.assertEqual(catalog, [{
                "id": "examples/new_demo.py::main", "file": "examples/new_demo.py",
                "symbol": "main", "title": "New example",
            }])


if __name__ == "__main__":
    unittest.main()
