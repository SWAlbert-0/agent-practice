"""纯标准库的静态索引：不导入业务模块，不读取配置、环境文件或安装包。"""

import ast
import json
import re
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = WEB_ROOT.parent
SOURCE_FILES = (
    "main.py", "core/llm.py", "core/agent.py", "core/message.py", "core/config.py",
    "agents/simple_agent.py", "agents/react_agent.py", "agents/reflection_agent.py",
    "agents/plan_solve_agent.py", "tools/base.py", "tools/registry.py",
    "tools/calculator_tool.py", "tools/search_tool.py", "tools/advanced_search.py",
    "tools/chain.py", "tools/async_executor.py", "test/test_simple_agent.py",
    "test/test_react_agent.py", "test/test_calculator.py", "test/test_calculator_tool.py",
    "test/test_tool_registry.py", "test/test_reflection_agent.py",
    "test/test_plan_solve_agent.py", "test/test_advanced_search.py",
)


def generate():
    units = {}
    for name in SOURCE_FILES:
        source = (PROJECT_ROOT / name).read_text(encoding="utf-8-sig")
        tree = ast.parse(source)
        symbols, definitions, imports = {}, {}, {}

        def walk(body, prefix=""):
            for node in body:
                if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                    key = prefix + node.name
                    symbols[key] = {"start": min([node.lineno] + [d.lineno for d in node.decorator_list]),
                                    "end": node.end_lineno, "doc": ast.get_docstring(node) or ""}
                    definitions[key] = node
                    if isinstance(node, ast.ClassDef):
                        walk(node.body, key + ".")

        walk(tree.body)
        # 默认 ReAct 模板在类外定义，纳入现有源码弹窗与调用导航。
        if name == "agents/react_agent.py":
            for node in tree.body:
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "DEFAULT_REACT_PROMPT" for t in node.targets):
                    symbols["DEFAULT_REACT_PROMPT"] = {"start": node.lineno, "end": node.end_lineno,
                                                       "doc": "ReAct 默认提示词模板"}
                    definitions["DEFAULT_REACT_PROMPT"] = node
        module = name[:-3].replace("/", ".")
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                prefix = module.split(".")[:-node.level] if node.level else []
                target = ".".join(prefix + ([node.module] if node.module else []))
                for alias in node.names:
                    imports[alias.asname or alias.name] = (target.replace(".", "/") + ".py", alias.name)
        units[name] = {"code": source, "tree": tree, "symbols": symbols,
                       "definitions": definitions, "imports": imports, "calls": [], "origin": "project"}

    def valid(ref):
        return ref and ref[0] in units and ref[1] in units[ref[0]]["definitions"]

    def named(file, name, prefer_import=False):
        unit = units[file]
        imported = unit["imports"].get(name)
        if prefer_import and valid(imported):
            return imported
        if name in unit["definitions"]:
            return file, name
        return imported if valid(imported) else None

    bases = {}
    for file, unit in units.items():
        for symbol, node in unit["definitions"].items():
            if isinstance(node, ast.ClassDef):
                # 按本地导入解析父类，兼容常规导入与显式 as 别名。
                bases[file, symbol] = [r for b in node.bases if isinstance(b, ast.Name)
                                       if (r := named(file, b.id, prefer_import=True))]

    def method(cls, name, visited=None):
        if not cls:
            return None
        visited = set() if visited is None else visited
        if cls in visited:
            return None
        visited.add(cls)
        ref = cls[0], cls[1] + "." + name
        if valid(ref):
            return ref
        for base in bases.get(cls, []):
            if ref := method(base, name, visited):
                return ref
        return None

    def annotation(file, expr):
        if isinstance(expr, ast.Constant) and isinstance(expr.value, str):
            try:
                expr = ast.parse(expr.value, mode="eval").body
            except SyntaxError:
                return None
        if isinstance(expr, ast.Name):
            ref = named(file, expr.id)
            return ref if valid(ref) and isinstance(units[ref[0]]["definitions"][ref[1]], ast.ClassDef) else None
        if isinstance(expr, ast.Subscript):
            return annotation(file, expr.slice)
        if isinstance(expr, ast.BinOp):
            return annotation(file, expr.left) or annotation(file, expr.right)
        return None

    attributes, factory_returns = {}, {}
    for file, unit in units.items():
        for symbol, definition in unit["definitions"].items():
            if "." in symbol or not isinstance(definition, ast.FunctionDef):
                continue
            locals_ = {}
            for item in definition.body:
                if isinstance(item, ast.Assign) and isinstance(item.value, ast.Call) and isinstance(item.value.func, ast.Name):
                    ref = named(file, item.value.func.id)
                    if valid(ref) and isinstance(units[ref[0]]["definitions"][ref[1]], ast.ClassDef):
                        for target in item.targets:
                            if isinstance(target, ast.Name):
                                locals_[target.id] = ref
                elif isinstance(item, ast.Return) and isinstance(item.value, ast.Name):
                    factory_returns[file, symbol] = locals_.get(item.value.id)
    # 这些未注解成员具有明确的模型客户端契约，不对任意同名变量猜测类型。
    contracts = {("agents/plan_solve_agent.py", c, "llm_client"): ("core/llm.py", "LLM")
                 for c in ("Planner", "Executor", "PlanAndSolveAgent")}
    contracts["agents/reflection_agent.py", "ReflectionAgent", "llm_client"] = ("core/llm.py", "LLM")

    def member_type(cls, attr):
        if not cls:
            return None
        ref = attributes.get((*cls, attr)) or contracts.get((*cls, attr))
        if ref:
            return ref
        for base in bases.get(cls, []):
            if ref := member_type(base, attr):
                return ref
        return None

    def infer(file, expr, env, cls):
        if isinstance(expr, ast.Name):
            return env.get(expr.id)
        if isinstance(expr, ast.Attribute):
            if isinstance(expr.value, ast.Name) and expr.value.id == "self":
                return member_type(cls, expr.attr)
            return member_type(infer(file, expr.value, env, cls), expr.attr)
        if isinstance(expr, ast.Call) and isinstance(expr.func, ast.Name):
            ref = named(file, expr.func.id)
            if ref:
                definition = units[ref[0]]["definitions"][ref[1]]
                return ref if isinstance(definition, ast.ClassDef) else annotation(ref[0], definition.returns) or factory_returns.get(ref)
        return None

    # 先静态传播参数与构造成员的类型，再建立调用链接；不执行任何源码。
    for _ in range(2):
        for file, unit in units.items():
            for symbol, node in unit["definitions"].items():
                if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                cls = (file, symbol.split(".")[0]) if "." in symbol else None
                env = {a.arg: annotation(file, a.annotation) for a in (*node.args.args, *node.args.kwonlyargs)}
                for item in ast.walk(node):
                    if isinstance(item, (ast.Assign, ast.AnnAssign)):
                        ref = annotation(file, item.annotation) if isinstance(item, ast.AnnAssign) else None
                        ref = ref or infer(file, item.value, env, cls)
                        for target in item.targets if isinstance(item, ast.Assign) else [item.target]:
                            if ref and isinstance(target, ast.Name):
                                env[target.id] = ref
                            elif ref and cls and isinstance(target, ast.Attribute) and ast.unparse(target.value) == "self":
                                attributes[*cls, target.attr] = ref

    for file, unit in units.items():
        lines = unit["code"].splitlines()

        def add(expr, ref):
            if not valid(ref) or expr.lineno != expr.end_lineno:
                return
            line = lines[expr.lineno - 1].encode("utf-8")
            # AST 列号是 UTF-8 字节，前端切片使用 UTF-16 单元。
            col = lambda offset: len(line[:offset].decode("utf-8").encode("utf-16-le")) // 2
            unit["calls"].append({"line": expr.lineno, "start": col(expr.col_offset),
                                  "end": col(expr.end_col_offset), "file": ref[0], "symbol": ref[1]})

        class Linker(ast.NodeVisitor):
            def __init__(self):
                self.cls = None
                self.env = {}

            def resolve(self, expr):
                if isinstance(expr, ast.Name):
                    return named(file, expr.id)
                if isinstance(expr, ast.Attribute):
                    if ast.unparse(expr.value) == "self":
                        return method(self.cls, expr.attr)
                    if ast.unparse(expr.value) == "super()":
                        return next((r for b in bases.get(self.cls, []) if (r := method(b, expr.attr))), None)
                    receiver = infer(file, expr.value, self.env, self.cls)
                    if not receiver and isinstance(expr.value, ast.Name):
                        candidate = named(file, expr.value.id)
                        if candidate in bases:
                            receiver = candidate
                    return method(receiver, expr.attr)
                return None

            def visit_ClassDef(self, node):
                previous, env = self.cls, self.env.copy()
                self.cls = (file, node.name)
                for base in node.bases:
                    add(base, named(file, base.id, True) if isinstance(base, ast.Name) else None)
                for item in node.body:
                    self.visit(item)
                self.cls, self.env = previous, env

            def visit_FunctionDef(self, node):
                previous = self.env.copy()
                self.env.update({a.arg: annotation(file, a.annotation) for a in (*node.args.args, *node.args.kwonlyargs)})
                for item in node.body:
                    self.visit(item)
                self.env = previous

            visit_AsyncFunctionDef = visit_FunctionDef

            def visit_Assign(self, node):
                ref = infer(file, node.value, self.env, self.cls)
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        self.env.pop(target.id, None)
                        if ref:
                            self.env[target.id] = ref
                self.generic_visit(node)

            def visit_AnnAssign(self, node):
                if isinstance(node.target, ast.Name):
                    self.env[node.target.id] = annotation(file, node.annotation) or infer(file, node.value, self.env, self.cls)
                self.generic_visit(node)

            def visit_Call(self, node):
                ref = self.resolve(node.func)
                if ref and isinstance(units[ref[0]]["definitions"][ref[1]], ast.ClassDef):
                    ref = method(ref, "__init__") or ref
                add(node.func, ref)
                for keyword in node.keywords:
                    if keyword.arg == "func":
                        add(keyword.value, self.resolve(keyword.value))
                self.generic_visit(node)

            def visit_Name(self, node):
                # 只链接明确索引的模板常量，不猜测一般变量的运行时指向。
                if isinstance(node.ctx, ast.Load) and node.id == "DEFAULT_REACT_PROMPT":
                    add(node, named(file, node.id))

        Linker().visit(unit["tree"])
        unit["calls"] = list({(c["line"], c["start"], c["end"]): c for c in unit["calls"]}.values())
    sources = {name: {k: unit[k] for k in ("code", "symbols", "calls", "origin")} for name, unit in units.items()}
    (WEB_ROOT / "sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indexed {len(sources)} local source files -> sources.json")
    return sources


def generate_diagrams(sources=None):
    """文档维护图定义，生成时验证所有源码入口，避免静默产生失效链接。"""
    sources = sources if sources is not None else json.loads((WEB_ROOT / "sources.json").read_text(encoding="utf-8"))
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
            raise ValueError(f"Missing Mermaid block for {entry['id']}")
        for ref in entry["sources"]:
            if ref["file"] not in sources or (ref["symbol"] and ref["symbol"] not in sources[ref["file"]]["symbols"]):
                raise ValueError(f"Invalid source in {entry['id']}: {ref['file']}::{ref['symbol']}")
        entry["code"] = blocks[entry.get("block", 0)].strip()
    (WEB_ROOT / "diagrams.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indexed {len(catalog)} documented diagrams")


if __name__ == "__main__":
    generate_diagrams(generate())
