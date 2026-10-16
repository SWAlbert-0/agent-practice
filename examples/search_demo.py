"""搜索工具运行演示，使用真实搜索服务。"""
from tools.search_tool import create_search_registry, SearchTool
from dotenv import load_dotenv


def demo_search():
    """通过注册表演示搜索工具"""

    # 创建包含搜索工具的注册表
    registry = create_search_registry()

    print("🔍 搜索工具演示\n")

    # 测试查询
    test_queries = [
        "Python编程语言的历史",
        "人工智能的最新发展",
        "2024年科技趋势"
    ]

    for i, query in enumerate(test_queries, 1):
        print(f"测试 {i}: {query}")
        result = registry.execute_tool("search", query)
        print(f"结果: {result}\n")
        print("-" * 60 + "\n")

def demo_direct_search():
    """直接创建搜索实例并执行查询"""
    print("🔍 直接搜索测试:")

    # 直接创建搜索工具实例
    search_tool = SearchTool()

    # 如果没有配置API，会显示配置提示
    result = search_tool.search("机器学习算法")
    print(f"搜索结果: {result}")

def demo_tool_description():
    """查看已注册的工具描述，不创建Agent"""
    print("\n🔧 工具描述检查:")

    # 显示工具描述
    registry = create_search_registry()
    tools_desc = registry.get_tools_description()
    print(f"工具描述:\n{tools_desc}")

if __name__ == "__main__":
    load_dotenv()
    demo_search()
    demo_direct_search()
    demo_tool_description()
