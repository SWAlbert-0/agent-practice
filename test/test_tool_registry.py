"""本地工具注册表的离线测试，不访问模型或搜索服务。"""

import pytest

from tools.base import Tool, ToolParameter
from tools.registry import ToolRegistry


class EchoTool(Tool):
    def __init__(self, name="echo"):
        super().__init__(name, "返回输入文本")

    def run(self, parameters):
        return parameters["input"]

    def get_parameters(self):
        return [ToolParameter(name="input", type="string", description="输入文本")]


def test_object_tool_lookup_execution_and_removal():
    registry = ToolRegistry()
    tool = EchoTool()
    registry.register_tool(tool)

    assert registry.get_tool("echo") is tool
    assert registry.execute_tool("echo", "hello") == "hello"
    assert registry.list_tools() == ["echo"]
    assert "echo" in registry.get_tools_description()
    assert registry.unregister_tool("echo") is True
    assert registry.get_tool("echo") is None
    assert registry.list_tools() == []


def test_function_tool_keeps_string_input_and_can_be_removed():
    registry = ToolRegistry()
    registry.register_function("uppercase", "转大写", str.upper)

    assert registry.execute_tool("uppercase", "hello") == "HELLO"
    assert registry.get_tool("uppercase") is None
    assert registry.list_tools() == ["uppercase"]
    assert registry.unregister_tool("uppercase") is True
    assert registry.list_tools() == []


def test_missing_tool():
    registry = ToolRegistry()

    assert registry.get_tool("missing") is None
    assert registry.execute_tool("missing", "hello") == "工具不存在: missing"
    assert registry.unregister_tool("missing") is False


def test_same_name_prefers_object_and_removes_both_registrations():
    registry = ToolRegistry()
    registry.register_function("echo", "函数工具", lambda text: "function")
    registry.register_tool(EchoTool())

    assert registry.execute_tool("echo", "object") == "object"
    assert registry.list_tools() == ["echo"]
    assert registry.unregister_tool("echo") is True
    assert registry.execute_tool("echo", "hello") == "工具不存在: echo"
    assert registry.list_tools() == []


def test_tool_exception_is_not_hidden():
    def fail(text):
        raise ValueError("工具执行失败")

    registry = ToolRegistry()
    registry.register_function("fail", "抛出异常", fail)

    with pytest.raises(ValueError, match="工具执行失败"):
        registry.execute_tool("fail", "hello")
