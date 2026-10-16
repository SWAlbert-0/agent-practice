"""本地计算器对象与函数工具的离线测试。"""

import pytest

from tools.base import Tool
from tools.calculator_tool import CalculatorTool, create_calculator_registry


@pytest.mark.parametrize("expression, expected", [
    ("15 * 8 + 32", "152"),
    ("(2 + 3) * 4", "20"),
    ("sqrt(16) + 2 * 3", "10.0"),
])
def test_calculator_object_execution(expression, expected):
    tool = CalculatorTool()

    assert isinstance(tool, Tool)
    assert tool.name == "calculator"
    assert tool.run({"input": expression}) == expected


def test_expression_parameter_compatibility():
    tool = CalculatorTool()

    assert tool.run({"expression": "2 + 3"}) == "5"
    assert tool.run({"input": "", "expression": "2 + 3"}) == "5"
    assert tool.run({"input": "2 + 3", "expression": "9 + 9"}) == "5"


def test_missing_input_and_calculation_errors():
    tool = CalculatorTool()

    assert tool.run({}) == "计算表达式不能为空"
    assert tool.run({"input": "   "}) == "计算表达式不能为空"
    assert tool.run({"input": "1 / 0"}).startswith("计算失败:")
    assert tool.run({"input": "2 +"}).startswith("计算失败:")


def test_calculator_parameters_match_run_input():
    parameters = CalculatorTool().get_parameters()

    assert len(parameters) == 1
    assert parameters[0].name == "input"
    assert parameters[0].type == "string"
    assert parameters[0].required is True


def test_object_and_existing_function_registration():
    registry = create_calculator_registry()
    tool = CalculatorTool()
    registry.register_tool(tool)

    assert registry.execute_tool("calculate", "sqrt(16)") == "4.0"
    assert registry.execute_tool("calculator", "15 * 8 + 32") == "152"
    assert registry.get_tool("calculator") is tool
    assert registry.list_tools() == ["calculator", "calculate"]
    assert registry.unregister_tool("calculator") is True
    assert registry.execute_tool("calculate", "2 + 3") == "5"
