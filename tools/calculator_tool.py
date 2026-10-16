import ast       # 把字符串表达式解析成语法树，保留括号和运算优先级。
import operator  # 提供加减乘除等函数，方便按语法树中的运算符查找并调用。
import math      # 提供 sqrt、pi 等数学函数和常量。
from typing import Any, Dict, List

from tools.base import Tool, ToolParameter
from tools.registry import ToolRegistry

def calculate(expression: str) -> str:
    """计算字符串中的数学表达式，例如 calculate("2 + 3 * 4") 返回 "14"。"""
    if not expression.strip():
        return "计算表达式不能为空"

    # expression 是字符串，Python 不会自动把它当作算式计算。
    # 这张表把“语法树中的运算符类型”关联到“实际执行运算的函数”。
    # 例如 ast.Add 表示加号，operator.add(2, 3) 等价于 2 + 3。
    operators = {
        ast.Add: operator.add,      # +
        ast.Sub: operator.sub,      # -
        ast.Mult: operator.mul,     # *
        ast.Div: operator.truediv,  # /
        ast.USub: operator.neg,     # -5 中的负号
        ast.UAdd: operator.pos      # +5 中的正号
    }

    # 明确允许使用的函数和常量；文本名称对应真正的 Python 对象。
    functions = {
        'sqrt': math.sqrt,
        'pi': math.pi,
    }

    try:
        # mode='eval' 表示“按单个表达式解析”，不接受赋值、循环等完整语句。
        # 它不是调用内置 eval()，这里只解析结构，不会执行表达式。
        # 内置 eval("2 + 3") 会直接执行并返回 5，但也能执行非数学的 Python 表达式。
        node = ast.parse(expression, mode='eval')

        # node 是表达式的外层包装，node.body 才是要计算的主体。
        # _eval_node 按上面的运算表递归求值，例如先算 3 * 4，再算 2 + 12。
        result = _eval_node(node.body, operators, functions)
        return str(result)
    except (SyntaxError, ValueError, ArithmeticError, TypeError) as e:
        # 返回具体的计算错误；未定义函数等编程错误不再被统一掩盖。
        return f"计算失败: {e}"

def _eval_node(node, operators, functions):
    """简化的表达式求值"""
    if isinstance(node, ast.Constant):  # Constant：常量节点，例如数字 2、3.5。
        return node.value
    elif isinstance(node, ast.BinOp):  # BinOp：二元运算节点，例如 2 + 3，包含左右操作数和运算符。
        left = _eval_node(node.left, operators, functions)
        right = _eval_node(node.right, operators, functions)
        op = operators.get(type(node.op))
        return op(left, right)
    elif isinstance(node, ast.Call): # Call：函数调用节点，例如 sqrt(16)。
        func_name = node.func.id
        if func_name in functions:
            args = [_eval_node(arg, operators, functions) for arg in node.args]
            return functions[func_name](*args)
    elif isinstance(node, ast.Name):  # Name：名称节点，例如 pi，需要从映射表中取出对应常量。
        if node.id in functions:
            return functions[node.id]

class CalculatorTool(Tool):
    """将计算函数封装为Tool对象，供Agent和注册表调用"""

    def __init__(self):
        super().__init__(
            name="calculator",
            description="执行数学计算，支持加减乘除、括号、sqrt函数和pi常量。例如：2+3*4、sqrt(16)。"
        )

    def run(self, parameters: Dict[str, Any]) -> str:
        """读取表达式并交给现有calculate函数求值"""
        # input 是工具的标准参数；expression 兼容原计算器的调用方式。
        expression = parameters.get("input", "") or parameters.get("expression", "")
        return calculate(expression)

    def get_parameters(self) -> List[ToolParameter]:
        """描述工具输入，参数名与run读取的input一致"""
        return [
            ToolParameter(
                name="input",
                type="string",
                description="数学表达式，例如 15 * 8 + 32 或 sqrt(16)",
                required=True
            )
        ]


def create_calculator_registry():
    """创建包含计算器的工具注册表"""
    registry = ToolRegistry()

    # 注册计算器函数
    registry.register_function(
        name="calculate",
        description="简单的数学计算工具，支持基本运算(+,-,*,/)和sqrt函数",
        func=calculate
    )

    return registry



