from tools.base import Tool
from typing import Any, Callable, Dict

class ToolRegistry:
    """工具注册表，统一管理对象工具和函数工具"""

    def __init__(self):
        self._tools: dict[str, Tool] = {}
        self._functions: dict[str, dict[str, Any]] = {}

    def register_tool(self, tool: Tool):
        """注册Tool对象"""
        if tool.name in self._tools:
            print(f"⚠️ 警告:工具 '{tool.name}' 已存在，将被覆盖。")
        self._tools[tool.name] = tool
        print(f"✅ 工具 '{tool.name}' 已注册。")

    def execute_tool(self, name: str, parameters: str) -> str:
        """根据名称执行工具；对象工具优先，函数工具接收原始字符串"""
        if name in self._tools:
            # 统一字符串入口使用 input 键；多参数工具可通过 get_tool() 后自行传入字典。
            return self._tools[name].run({"input": parameters})

        if name in self._functions:
            # 注册时保存了函数对象，这里取出并传入参数执行。
            func = self._functions[name]["func"]
            return func(parameters)

        return f"工具不存在: {name}"

    def get_tool(self, name: str) -> Tool | None:
        """按名称获取Tool对象；函数工具不在对象表中"""
        return self._tools.get(name)

    def list_tools(self) -> list[str]:
        """列出对象工具与函数工具的名称，同名只显示一次"""
        return list(dict.fromkeys([*self._tools, *self._functions]))

    def unregister_tool(self, name: str) -> bool:
        """移除指定名称的工具，返回是否找到并移除了注册项"""
        found = name in self._tools or name in self._functions
        # 两张表都清理，避免同名对象被移除后又调用到旧的函数。
        self._tools.pop(name, None)
        self._functions.pop(name, None)
        return found
        
    def register_function(self, name: str, description: str, func: Callable[[str], str]):
        """
        直接注册函数作为工具（简便方式）

        Args:
            name: 工具名称
            description: 工具描述
            func: 工具函数，接受字符串参数，返回字符串结果
        """
        if name in self._functions:
            print(f"⚠️ 警告:工具 '{name}' 已存在，将被覆盖。")

        self._functions[name] = {
            "description": description,
            "func": func
        }
        print(f"✅ 工具 '{name}' 已注册。")

    def get_tools_description(self) -> str:
        """获取所有可用工具的格式化描述字符串"""
        descriptions = []

        # Tool对象描述
        for tool in self._tools.values():
            descriptions.append(f"- {tool.name}: {tool.description}")

        # 函数工具描述
        for name, info in self._functions.items():
            descriptions.append(f"- {name}: {info['description']}")

        return "\n".join(descriptions) if descriptions else "暂无可用工具"

    def to_openai_schema(self) -> Dict[str, Any]:
            """转换为 OpenAI function calling schema 格式

            用于 FunctionCallAgent，使工具能够被 OpenAI 原生 function calling 使用

            Returns:
                符合 OpenAI function calling 标准的 schema
            """
            parameters = self.get_parameters()

            # 构建 properties
            properties = {}
            required = []

            for param in parameters:
                # 基础属性定义
                prop = {
                    "type": param.type,
                    "description": param.description
                }

                # 如果有默认值，添加到描述中（OpenAI schema 不支持 default 字段）
                if param.default is not None:
                    prop["description"] = f"{param.description} (默认: {param.default})"

                # 如果是数组类型，添加 items 定义
                if param.type == "array":
                    prop["items"] = {"type": "string"}  # 默认字符串数组

                properties[param.name] = prop

                # 收集必需参数
                if param.required:
                    required.append(param.name)

            return {
                "type": "function",
                "function": {
                    "name": self.name,
                    "description": self.description,
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "required": required
                    }
                }
            }
