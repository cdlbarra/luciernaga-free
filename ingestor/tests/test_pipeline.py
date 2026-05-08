import pytest, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from main import run_pipeline

SOURCES = [
    {"type": "csv",  "data": "id,name\n1,test"},
    {"type": "json", "data": {"id": 1}},
    {"type": "api",  "url": "https://example.com/feed"},
    {"type": "xml",  "data": "<root><item>1</item></root>"},
    {"type": "txt",  "data": "línea 1\nlínea 2"},
]

@pytest.mark.parametrize("source", SOURCES)
def test_pipeline(source):
    result = run_pipeline(source)
    assert "quality" in result
    assert isinstance(result["errors"], list)
