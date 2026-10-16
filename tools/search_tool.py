from tools.base import Tool
import os
from typing import Optional

class SearchTool(Tool):
    """
    智能混合搜索工具

    支持多种搜索引擎后端，智能选择最佳搜索源:
    1. 混合模式 (hybrid) - 智能选择TAVILY或SERPAPI
    2. Tavily API (tavily) - 专业AI搜索
    3. SerpApi (serpapi) - 传统Google搜索
    """

    def __init__(self, backend: str = "hybrid", tavily_key: Optional[str] = None, serpapi_key: Optional[str] = None):
        super().__init__(
            name="search",
            description="一个智能网页搜索引擎。支持混合搜索模式，自动选择最佳搜索源。"
        )
        self.backend = backend
        self.tavily_key = tavily_key or os.getenv("TAVILY_API_KEY")
        self.serpapi_key = serpapi_key or os.getenv("SERPAPI_API_KEY")
        self.available_backends = []
        self._setup_backends()

    def _search_hybrid(self, query: str) -> str:
        """"混合搜索 - 智能选择最佳搜索源"""
        # 优先使用 Tavily（AI优化的搜索）
        if "tavily" in self.available_backends:
            try:
                return self._search_tavily(query)
            except Exception as e:
                print(f"⚠️ Tavily搜索失败: {e}")
                # 如果Tavily失败，尝试SerpApi
                if "serpapi" in self.available_backends:
                    print("🔄 切换到SerpApi搜索")
                    return self._search_serpapi(query)

        # 如果Tavily不可用，使用SerpApi
        elif "serpapi" in self.available_backends:
            try:
                return self._search_serpapi(query)
            except Exception as e:
                print(f"⚠️ SerpApi搜索失败: {e}")

        # 如果都不可用，提示用户配置API
        return "❌ 没有可用的搜索源，请配置TAVILY_API_KEY或SERPAPI_API_KEY环境变量"

    def _search_tavily(self, query: str) -> str:
        """"使用Tavily搜索"""
        response = self.tavily_client.search(
            query = query,
            search_depth = "basic",
            include_answer = True,
            max_results = 3
        )

        result = f"🎯 Tavily AI搜索结果:{response.get('answer', '未找到直接答案')}\n\n"

        for i, item in enumerate(response.get('results', [][:3], 1)):
            result += f"[{i}] {item.get('title', '')}\n"
            result += f"    {item.get('content', '')[:200]}...\n"
            result += f"    来源: {item.get('url', '')}\n\n"

        return result

    def _search_serpapi(self, query: str) -> str:
        """使用SerpApi搜索，返回直接答案及前三条网页结果"""
        import serpapi

        # 新版 SDK 使用 Client，密钥沿用构造函数读取的 SERPAPI_API_KEY。
        client = serpapi.Client(api_key=self.serpapi_key)
        response = client.search({
            "engine": "google",
            "q": query,
            "gl": "cn",
            "hl": "zh-cn"
        })

        # answer_box 是搜索结果中的直接答案，可能只有摘要而没有 answer。
        answer_box = response.get("answer_box", {})
        answer = answer_box.get("answer") or answer_box.get("snippet", "")
        items = response.get("organic_results", [])[:3]

        if not answer and not items:
            return f"未找到关于 '{query}' 的搜索结果。"

        result = "🔍 SerpApi Google搜索结果:\n\n"
        if answer:
            result += f"💡 直接答案: {answer}\n\n"

        # SerpApi 的摘要、链接字段分别是 snippet、link，与 Tavily 不同。
        for i, item in enumerate(items, 1):
            result += f"[{i}] {item.get('title', '')}\n"
            result += f"    {item.get('snippet', '')[:200]}...\n"
            result += f"    来源: {item.get('link', '')}\n\n"

        return result
