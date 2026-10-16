# test_advanced_search.py
from tools.advanced_search import create_advanced_search_registry, AdvancedSearchTool
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

def test_advanced_search():
    """测试高级搜索工具"""

    # 创建包含高级搜索工具的注册表
    registry = create_advanced_search_registry()

    print("🔍 测试高级搜索工具\n")

    # 测试查询
    test_queries = [
        "Python编程语言的历史",
        "人工智能的最新发展",
        "2024年科技趋势"
    ]

    for i, query in enumerate(test_queries, 1):
        print(f"测试 {i}: {query}")
        result = registry.execute_tool("advanced_search", query)
        print(f"结果: {result}\n")
        print("-" * 60 + "\n")

def test_direct_search():
    """直接创建搜索实例并执行查询"""
    print("🔍 直接搜索测试:")

    # 直接创建搜索工具实例
    search_tool = AdvancedSearchTool()

    # 如果没有配置API，会显示配置提示
    result = search_tool.search("机器学习算法")
    print(f"搜索结果: {result}")

def test_tool_description():
    """查看已注册的工具描述，不创建Agent"""
    print("\n🔧 工具描述检查:")

    # 显示工具描述
    registry = create_advanced_search_registry()
    tools_desc = registry.get_tools_description()
    print(f"工具描述:\n{tools_desc}")

if __name__ == "__main__":
    test_advanced_search()
    test_direct_search()
    test_tool_description()
