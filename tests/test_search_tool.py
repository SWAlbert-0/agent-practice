"""搜索工具的离线测试：模拟 SDK，不读取真实密钥或访问网络。"""

import importlib
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from agents.simple_agent import SimpleAgent
from tools.search_tool import SearchTool, create_search_registry


@pytest.fixture
def clients(monkeypatch):
    tavily = Mock()
    serpapi = Mock()
    tavily.search.return_value = {"results": []}
    serpapi.search.return_value = {"organic_results": []}
    monkeypatch.setenv("TAVILY_API_KEY", "test-tavily")
    monkeypatch.setenv("SERPAPI_API_KEY", "test-serpapi")
    monkeypatch.setitem(sys.modules, "tavily", SimpleNamespace(TavilyClient=Mock(return_value=tavily)))
    monkeypatch.setitem(sys.modules, "serpapi", SimpleNamespace(Client=Mock(return_value=serpapi)))
    return tavily, serpapi


def test_registration_does_not_search_and_supports_both_input_keys(clients):
    tavily, serpapi = clients
    registry = create_search_registry()
    tavily.search.assert_not_called()
    serpapi.search.assert_not_called()
    tool = registry.get_tool("search")
    assert isinstance(tool, SearchTool)
    assert tool.get_parameters()[0].name == "query"
    tavily.search.return_value = {"results": [{"title": "Python", "content": "语言", "url": "https://python.org"}]}
    assert "https://python.org" in registry.execute_tool("search", "Python")
    assert "Python" in tool.run({"query": "Python"})
    assert tavily.search.call_args.kwargs["query"] == "Python"
    serpapi.search.assert_not_called()


@pytest.mark.parametrize("mode", ["empty", "error"])
def test_hybrid_falls_back_on_empty_results_or_exception(clients, mode):
    tavily, serpapi = clients
    if mode == "error":
        tavily.search.side_effect = RuntimeError("request failed")
    serpapi.search.return_value = {"organic_results": [{"title": "来源", "snippet": "摘要", "link": "https://example.com"}]}
    result = SearchTool().search("query")
    assert "SerpApi" in result
    assert "https://example.com" in result
    assert serpapi.search.call_args.args[0]["q"] == "query"


@pytest.mark.parametrize("backend", ["tavily", "serpapi"])
def test_explicit_backend_does_not_use_other_source(clients, backend):
    tavily, serpapi = clients
    tool = SearchTool(backend=backend)
    assert tool.available_backends == [backend]
    assert "未找到" in tool.search("query")
    other = serpapi if backend == "tavily" else tavily
    other.search.assert_not_called()


def test_empty_query_and_no_credentials_do_not_request(clients, monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY")
    monkeypatch.delenv("SERPAPI_API_KEY")
    tool = SearchTool()
    assert "不能为空" in tool.search(" ")
    assert "没有可用" in tool.search("query")
    for client in clients:
        client.search.assert_not_called()


def test_missing_optional_sdks(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "test")
    monkeypatch.setenv("SERPAPI_API_KEY", "test")
    monkeypatch.setitem(sys.modules, "tavily", None)
    monkeypatch.setitem(sys.modules, "serpapi", None)
    assert SearchTool().available_backends == []


def test_all_backend_errors_return_failure_without_credentials(clients, capsys):
    tavily, serpapi = clients
    tavily.search.side_effect = RuntimeError("test-tavily")
    serpapi.search.return_value = {"error": "test-serpapi"}
    result = SearchTool().search("query")
    assert "搜索未成功" in result
    output = capsys.readouterr().out
    assert "test-tavily" not in output
    assert "test-serpapi" not in output


def test_unknown_backend_is_rejected():
    with pytest.raises(ValueError):
        SearchTool(backend="unknown")


def test_simple_agent_receives_search_result(clients):
    tavily, _ = clients
    tavily.search.return_value = {"results": [{"title": "Python", "url": "https://python.org"}]}
    llm = Mock()
    llm.invoke.side_effect = ["[TOOL_CALL:search:Python]", "已找到 Python 官方网站"]
    agent = SimpleAgent("搜索助手", llm, tool_registry=create_search_registry())
    assert agent.run("搜索 Python") == "已找到 Python 官方网站"
    messages = llm.invoke.call_args.args[0]
    assert any("https://python.org" in message["content"] for message in messages)
    tavily.search.assert_called_once()


def test_importing_examples_does_not_create_clients(monkeypatch):
    monkeypatch.setattr("core.llm.create_llm", Mock(side_effect=AssertionError("unexpected LLM")))
    monkeypatch.setattr("tools.search_tool.create_search_registry", Mock(side_effect=AssertionError("unexpected search")))
    for name in ("simple_agent", "reflection_agent", "plan_solve_agent", "calculator", "search"):
        module = importlib.import_module(f"examples.{name}_demo")
        importlib.reload(module)
