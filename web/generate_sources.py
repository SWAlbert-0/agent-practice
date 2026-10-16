"""从白名单 Python 文件生成前端源码索引；不读取 .env 或模型凭证。"""

import ast
import importlib.util
import json
import re
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = WEB_ROOT.parent


def generate():
    sources = {}
    files = {name: PROJECT_ROOT / name for name in (
        "main.py", "core/agent.py", "core/message.py", "core/config.py", "core/llm.py",
        "agents/simple_agent.py", "tools/base.py", "tools/registry.py", "tools/calculator_tool.py",
        "test/test_simple_agent.py", "test/test_calculator.py"
    )}
    # 第三方实现可选：请在项目 Conda 环境中运行，以索引实际安装版本。
    try:
        spec = importlib.util.find_spec("hello_agents")
        if spec and spec.submodule_search_locations:
            package_root = Path(next(iter(spec.submodule_search_locations)))
            for name in ("core/llm.py", "core/agent.py", "core/message.py", "core/config.py",
                         "agents/simple_agent.py", "tools/registry.py", "tools/base.py", "tools/builtin/calculator.py"):
                files[f"hello_agents/{name}"] = package_root / name
    except (ImportError, ValueError):
        pass
    for name, path in files.items():
        if not path.is_file():
            continue
        source = path.read_text(encoding="utf-8-sig")
        tree = ast.parse(source)
        symbols = {}

        def walk(body, prefix=""):
            for node in body:
                if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                    key = prefix + node.name
                    start = min([node.lineno] + [d.lineno for d in node.decorator_list])
                    symbols[key] = {"start": start, "end": node.end_lineno,
                                    "doc": ast.get_docstring(node) or ""}
                    if isinstance(node, ast.ClassDef):
                        walk(node.body, key + ".")

        walk(tree.body)
        lines = source.splitlines()
        calls = []

        def add_link(expr, target_file, target_symbol):
            if expr.lineno != expr.end_lineno:
                return
            # AST 的列号按 UTF-8 字节计算，前端字符串按 UTF-16 单元索引。
            line = lines[expr.lineno - 1].encode("utf-8")
            col = lambda offset: len(line[:offset].decode("utf-8").encode("utf-16-le")) // 2
            calls.append({"line": expr.lineno, "start": col(expr.col_offset),
                          "end": col(expr.end_col_offset), "file": target_file, "symbol": target_symbol})

        sdk_agent = "hello_agents/core/agent.py"
        sdk_llm = "hello_agents/core/llm.py"
        is_sdk = name.startswith("hello_agents/")
        for item in ast.walk(tree):
            if isinstance(item, ast.ClassDef) and item.name == "SimpleAgent":
                for base in item.bases:
                    if name == "agents/simple_agent.py":
                        add_link(base, "hello_agents/agents/simple_agent.py", "SimpleAgent")
                    elif name == "hello_agents/agents/simple_agent.py":
                        add_link(base, sdk_agent, "Agent")
            if not isinstance(item, ast.Call):
                continue
            # 注册函数时 func=calculate 也是关键的静态绑定，但不是直接调用。
            for keyword in item.keywords:
                if keyword.arg == "func" and isinstance(keyword.value, ast.Name) and keyword.value.id in symbols:
                    add_link(keyword.value, name, keyword.value.id)
            func = ast.unparse(item.func)
            target = None
            if func == "create_llm":
                target = ("core/llm.py", "create_llm")
            elif func == "HelloAgentsLLM":
                target = (sdk_llm, "HelloAgentsLLM.__init__")
            elif func == "ToolRegistry":
                target = ("tools/registry.py" if name in ("tools/calculator_tool.py", "tools/registry.py") else "hello_agents/tools/registry.py", "ToolRegistry.__init__")
            elif func == "SimpleAgent" and name == "test/test_simple_agent.py":
                target = ("agents/simple_agent.py", "SimpleAgent.__init__")
            elif func == "CalculatorTool" and name == "test/test_simple_agent.py":
                target = ("hello_agents/tools/builtin/calculator.py", "CalculatorTool.__init__")
            elif func == "create_calculator_registry":
                target = ("tools/calculator_tool.py", "create_calculator_registry")
            elif func.startswith("registry.") and name in ("test/test_calculator.py", "tools/calculator_tool.py"):
                target = ("tools/registry.py", "ToolRegistry." + func.rsplit(".", 1)[-1])
            elif func.startswith("tool_registry.") and name == "test/test_simple_agent.py":
                target = ("hello_agents/tools/registry.py", "ToolRegistry." + func.rsplit(".", 1)[-1])
            elif func.startswith(("basic_agent.", "enhanced_agent.")) and name == "test/test_simple_agent.py":
                method = func.rsplit(".", 1)[-1]
                target = ((sdk_agent, "Agent." + method) if method in ("get_history", "add_message", "clear_history")
                          else ("agents/simple_agent.py", "SimpleAgent." + method))
            elif (name == "main.py" or name.startswith("test/")) and func in ("llm.think", "llm.invoke", "llm.stream_invoke"):
                target = (sdk_llm, "HelloAgentsLLM." + func.rsplit(".", 1)[-1])
            elif func.startswith("self.llm."):
                target = (sdk_llm, "HelloAgentsLLM." + func.rsplit(".", 1)[-1])
            elif func in ("self.get_history", "self.add_message", "self.clear_history"):
                target = (sdk_agent if is_sdk or name == "agents/simple_agent.py" else name,
                          "Agent." + func.rsplit(".", 1)[-1])
            elif func.startswith("self.tool_registry."):
                target = ("hello_agents/tools/registry.py", "ToolRegistry." + func.rsplit(".", 1)[-1])
            elif func.startswith("self.") and "SimpleAgent." + func[5:] in symbols:
                target = (name, "SimpleAgent." + func[5:])
            elif func.startswith("self.") and "HelloAgentsLLM." + func[5:] in symbols:
                target = (name, "HelloAgentsLLM." + func[5:])
            elif func in ("Message", "Config"):
                prefix = "hello_agents/" if is_sdk or name == "agents/simple_agent.py" else ""
                target = (f"{prefix}core/{func.lower()}.py", func)
            elif func == "super().__init__" and name.endswith("agents/simple_agent.py"):
                target = ((sdk_agent, "Agent.__init__") if is_sdk else
                          ("hello_agents/agents/simple_agent.py", "SimpleAgent.__init__"))
            elif func in symbols:
                target = (name, func)
            elif func.startswith("self."):
                enclosing = [s for s, span in symbols.items() if "." in s and span["start"] <= item.lineno <= span["end"]]
                if enclosing:
                    candidate = enclosing[0].split(".")[0] + "." + func[5:]
                    if candidate in symbols:
                        target = (name, candidate)
            if target:
                add_link(item.func, *target)
        sources[name] = {"code": source, "symbols": symbols, "calls": calls,
                         "origin": "framework" if is_sdk else "project"}
    # 只保留实际存在的目标；不凭函数同名猜测跨文件调用。
    for entry in sources.values():
        entry["calls"] = [c for c in entry["calls"]
                          if c["file"] in sources and c["symbol"] in sources[c["file"]]["symbols"]]
    target = WEB_ROOT / "sources.json"
    target.write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indexed {len(sources)} source files -> {target.name}")
    return sources


def generate_diagrams():
    """文档是图定义的唯一来源；前端只加载提取结果和源码关联。"""
    catalog = json.loads((WEB_ROOT / "flows.json").read_text(encoding="utf-8"))
    seen = set()
    for entry in catalog:
        if entry["id"] in seen:
            raise ValueError(f"Duplicate diagram ID: {entry['id']}")
        seen.add(entry["id"])
        path = (PROJECT_ROOT / entry["document"]).resolve()
        if not path.is_relative_to(PROJECT_ROOT / "docs"):
            raise ValueError("Diagram document must be inside docs")
        blocks = re.findall(r"```mermaid\s*\n(.*?)```", path.read_text(encoding="utf-8"), re.S)
        if not 0 <= entry.get("block", 0) < len(blocks):
            raise ValueError(f"Missing Mermaid block for {entry['id']} in {entry['document']}")
        entry["code"] = blocks[entry.get("block", 0)].strip()
    (WEB_ROOT / "diagrams.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indexed {len(catalog)} documented diagrams")


if __name__ == "__main__":
    generate()
    generate_diagrams()
