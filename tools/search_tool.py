"""网页搜索工具：优先使用 Tavily，可回退到 SerpApi。"""

import os
from typing import Optional

from tools.base import Tool, ToolParameter
from tools.registry import ToolRegistry


class SearchTool(Tool):
    """统一的搜索入口，支持 hybrid、tavily 和 serpapi 后端。"""

    def __init__(self, backend: str = "hybrid", tavily_key: Optional[str] = None,
                 serpapi_key: Optional[str] = None):
        super().__init__(name="search", description="搜索网页，返回标题、摘要和来源链接。")
        if backend not in ("hybrid", "tavily", "serpapi"):
            raise ValueError(f"不支持的搜索后端: {backend}")
        self.backend = backend
        self.tavily_key = tavily_key or os.getenv("TAVILY_API_KEY")
        self.serpapi_key = serpapi_key or os.getenv("SERPAPI_API_KEY")
        self.available_backends = []
        self._setup_backends()

    def _setup_backends(self):
        """只初始化选用且已配置的 SDK，不在初始化时发起搜索。"""
        if self.backend in ("hybrid", "tavily") and self.tavily_key:
            try:
                from tavily import TavilyClient
            except ImportError:
                print("⚠️ 请安装 tavily-python 以使用 Tavily")
            else:
                self.tavily_client = TavilyClient(api_key=self.tavily_key)
                self.available_backends.append("tavily")

        if self.backend in ("hybrid", "serpapi") and self.serpapi_key:
            try:
                from serpapi import Client
            except ImportError:
                print("⚠️ 请安装 serpapi 以使用 SerpApi Client")
            else:
                self.serpapi_client = Client(api_key=self.serpapi_key)
                self.available_backends.append("serpapi")

    def run(self, parameters: dict) -> str:
        """query 供 Agent 传入；input 供注册表的字符串入口传入。"""
        query = parameters.get("query") or parameters.get("input", "")
        return self.search(query)

    def get_parameters(self) -> list[ToolParameter]:
        return [ToolParameter(name="query", type="string", description="要搜索的关键词或问题")]

    def search(self, query: str) -> str:
        """按配置顺序尝试搜索源；空结果或请求失败时尝试下一源。"""
        if not query.strip():
            return "搜索查询不能为空"
        if not self.available_backends:
            return "没有可用的搜索源，请配置搜索密钥并安装对应 SDK"

        errors = []
        for backend in self.available_backends:
            try:
                result = (self._search_tavily(query) if backend == "tavily"
                          else self._search_serpapi(query))
                if result:
                    return result
            except Exception as error:
                # 后端之间可以回退；日志不输出可能携带凭证的异常正文。
                print(f"⚠️ {backend} 搜索失败（{type(error).__name__}）")
                errors.append(backend)
        if errors:
            return "搜索未成功，请检查网络、搜索服务配置或更换查询"
        return f"未找到关于 '{query}' 的搜索结果"

    def _search_tavily(self, query: str) -> str:
        response = self.tavily_client.search(
            query=query, search_depth="basic", include_answer=True, max_results=3
        )
        answer = response.get("answer")
        items = response.get("results", [])[:3]
        if not answer and not items:
            return ""

        result = "📊 Tavily 搜索结果:\n"
        if answer:
            result += f"直接答案: {answer}\n\n"
        for i, item in enumerate(items, 1):
            result += f"[{i}] {item.get('title', '')}\n"
            result += f"    {item.get('content', '')[:200]}\n"
            result += f"    来源: {item.get('url', '')}\n\n"
        return result

    def _search_serpapi(self, query: str) -> str:
        response = self.serpapi_client.search({
            "engine": "google", "q": query, "gl": "cn", "hl": "zh-cn"
        })
        if response.get("error"):
            raise RuntimeError("SerpApi 返回错误响应")
        answer_box = response.get("answer_box", {})
        answer = answer_box.get("answer") or answer_box.get("snippet")
        items = response.get("organic_results", [])[:3]
        if not answer and not items:
            return ""

        result = "🌐 SerpApi 搜索结果:\n"
        if answer:
            result += f"直接答案: {answer}\n\n"
        for i, item in enumerate(items, 1):
            result += f"[{i}] {item.get('title', '')}\n"
            result += f"    {item.get('snippet', '')[:200]}\n"
            result += f"    来源: {item.get('link', '')}\n\n"
        return result


def create_search_registry(backend: str = "hybrid") -> ToolRegistry:
    """创建注册了 search 对象工具的本地注册表。"""
    registry = ToolRegistry()
    registry.register_tool(SearchTool(backend=backend))
    return registry
