from dotenv import load_dotenv
from tools.calculator_tool import create_calculator_registry
from core.llm import create_llm


def demo_calculator_tool():
    """测试自定义计算器工具"""

    # 创建包含计算器的注册表
    registry = create_calculator_registry()

    print("🧪 测试自定义计算器工具\n")

    # 简单测试用例
    test_cases = [
        "2 + 3",           # 基本加法
        "10 - 4",          # 基本减法
        "5 * 6",           # 基本乘法
        "15 / 3",          # 基本除法
        "sqrt(16)",        # 平方根
    ]

    for i, expression in enumerate(test_cases, 1):
        print(f"测试 {i}: {expression}")
        result = registry.execute_tool("calculate", expression)
        print(f"结果: {result}\n")

def demo_calculator_with_llm():
    """计算器执行后由LLM组织回答，不创建Agent"""
    
    # 创建LLM客户端
    llm = create_llm()

    # 创建包含计算器的注册表
    registry = create_calculator_registry()

    print("🤖 计算器与LLM编排测试:")

    # 手动编排工具调用与模型回答
    user_question = "请帮我计算 sqrt(16) + 2 * 3"

    print(f"用户问题: {user_question}")

    # 使用工具计算
    calc_result = registry.execute_tool("calculate", "sqrt(16) + 2 * 3")
    print(f"计算结果: {calc_result}")

    # 构建最终回答
    final_messages = [
        {"role": "user", "content": f"计算结果是 {calc_result}，请用自然语言回答用户的问题:{user_question}"}
    ]

    print("\n🎯 模型回答:")
    response = llm.think(final_messages)
    for chunk in response:
        print(chunk, end="", flush=True)
    print("\n")

if __name__ == "__main__":
    load_dotenv()
    demo_calculator_tool()
    demo_calculator_with_llm()
