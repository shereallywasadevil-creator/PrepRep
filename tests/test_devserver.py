"""Starter test: the dev server's engine stand-in answers like Engine.cs. Add tests for your own logic here."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("devserver", Path(__file__).resolve().parent.parent / "tools" / "devserver.py")
devserver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(devserver)


class DevServerTest(unittest.TestCase):
    def test_finds_the_screens(self):
        self.assertTrue((devserver.WEB / "index.html").is_file())


if __name__ == "__main__":
    unittest.main()
