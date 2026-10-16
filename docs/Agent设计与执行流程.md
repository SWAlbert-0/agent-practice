# Agent 设计与执行流程

核对日期：2026-10-17。本文依据 `agents/` 当前实现，描述职责、调用过程与已有边界，不代表全部路径都经过真实模型测试。

## 1. 客户端与 Agent 的关系

```python
from core.llm import create_llm
from agents.reflection_agent import ReflectionAgent

llm = create_llm()
agent = ReflectionAgent(name="反思助手", llm=llm)
result = agent.run("解释什么是生成器")
```

客户端决定连接哪个服务和模型；Agent 决定如何组织消息、何时请求模型、是否调用工具或进入下一轮。把客户端传入 Agent 是依赖注入，并不执行模型切换。

| Agent | 主要职责 | 调用方式 | 状态保存 |
|---|---|---|---|
| SimpleAgent | 普通对话与可选工具循环 | `invoke()` / `stream_invoke()` | 本地 Agent 消息历史 |
| ReActAgent | 推理、行动、观察交替进行 | `invoke()` | 当前任务轨迹，完成时保存问答 |
| ReflectionAgent | 初次回答后反思与改进 | 消费 `think()` 并拼接 | 本地 Memory，运行时重置 |
| PlanAndSolveAgent | 先规划，再按步骤求解 | 消费 `think()` 并拼接 | Executor 内的步骤结果字符串 |

这些 Agent 不能假定具有完全相同的构造参数和方法。例如 PlanAndSolveAgent 使用 `llm_client`，ReflectionAgent 使用 `llm`，两者都没有实现 `get_history()`。

## 2. SimpleAgent

文件：`agents/simple_agent.py`。直接继承本地 `core.agent.Agent`，消息、配置、客户端与注册表全部来自本地模块。

### 普通对话

`run()` 构建增强系统提示词，加入历史和当前用户消息。工具未启用时调用 `llm.invoke()`，保存本轮用户消息和最终回答，然后返回文本。

### 工具循环

```text
构建工具说明 → 请求模型 → 解析 [TOOL_CALL:名称:参数]
  → 执行工具 → 把结果加入当前上下文 → 再次请求模型
  → 没有工具标记或达到轮数上限 → 保存最终问答
```

| 方法 | 作用 |
|---|---|
| `_get_enhanced_system_prompt()` | 将可用工具及文本调用格式加入提示词 |
| `_run_with_tool_calling()` | 驱动模型与工具之间的迭代 |
| `_parse_tool_calls()` | 从模型文本中提取工具名称与参数 |
| `_execute_tool_call()` | 选择执行路径，工具异常转为错误文本 |
| `_parse_tool_parameters()` | 本地类定义的参数解析方法，为对象工具整理字典参数 |

这是提示词约束的文本协议，未使用原生 `tool_calls` 字段。工具结果作为用户消息追加，最终保存的历史只包含原问题与最终回答，不包含完整工具轨迹。

当前工具名为 `calculator` 时走注册表执行方法；其他名称走 `get_tool()` 后调用 `tool.run()`。本地注册表支持对象与函数，但这里的一般名称只查询对象表。

新增高级搜索工厂把 `AdvancedSearchTool.search()` 注册到本地函数表，注册名是 `advanced_search`。当前 SimpleAgent 对这类名称仍走对象工具的 `get_tool()` 路径，`get_tool()` 只查询对象表，所以高级搜索测试通过不代表它已接入 SimpleAgent。搜索测试的 `test_tool_description()` 实际只展示工具描述。

`_parse_tool_parameters()` 对 `search` 生成 `query` 键，对其他一般工具生成 `input` 键，也支持简单的 `key=value` 拆分。接入对象工具时需核对其真正接受的字段，不能仅凭名称相同判断可用。

### 流式对话

`stream_run()` 是生成器：迭代 `llm.stream_invoke()`，累计 `full_response`，同时 `yield chunk`。完整迭代后才保存问答；提前结束迭代或发生异常时，尾部历史保存不会正常执行。此路径当前没有工具循环。

### 当前边界

- 迭代上限后的最后一次模型回答不会再次解析工具标记。
- `remove_tool()` 已对接本地 `unregister_tool()`，但有注册表时固定返回 True，不转发注册表的 found 值。
- 已有注册表但禁用工具时，`add_tool()` 不一定重新启用工具调用；`has_tools()` 只检查开关和注册表存在，不统计实际工具数。

## 3. ReActAgent

文件：`agents/react_agent.py`。直接继承本地 `core.agent.Agent`，使用本地提示词、解析方法与循环。

构造时优先使用非空 `custom_prompt`，否则使用 `DEFAULT_REACT_PROMPT`。默认模板提供 `{tools}`、`{question}`、`{history}` 占位符；模板在初始化时选定，不会在每次 `run()` 时重新选择。

```text
工具说明 + 问题 + 已有轨迹
  → invoke → 解析 Thought / Action
  → Finish：保存问答并返回
  → 工具行动：执行工具，追加 Action / Observation，继续
  → 达到 max_steps：返回无法完成的提示
```

`current_history` 在每次 `run()` 开始时清空，保存本轮行动与观察。输出由本类的 `_parse_output()`、`_parse_action()` 和 `_parse_action_input()` 解析；工具通过传入注册表的 `execute_tool()` 调用。

`super().__init__(name, llm, system_prompt, config)` 与本地 Agent 的参数顺序一致；注册表由 ReActAgent 自己保存。工具执行异常直接传播，缺少 Action 则继续消耗步数。

自定义 `run()` 用模板构建用户消息，没有把 `system_prompt` 单独加入请求；历史列表也没有把所有 Thought 文本完整保存下来。

## 4. ReflectionAgent

文件：`agents/reflection_agent.py`。独立的本地类，不继承 Agent。

```text
初次执行 → 保存 execution
  → 反思 → 保存 reflection
  → feedback.strip() == "无需改进"：停止
  → 否则改进并保存 execution → 下一轮反思
  → 返回最近一次 execution
```

| 方法或字段 | 作用 |
|---|---|
| `DEFAULT_PROMPTS` | 提供通用初次执行、反思和改进模板 |
| `custom_prompts` | 覆盖指定模板键，保留未覆盖的默认模板 |
| `Memory.add_record()` | 记录执行结果或反思反馈 |
| `Memory.get_last_execution()` | 从后往前查找最近的执行结果 |
| `Memory.get_trajectory()` | 格式化完整轨迹；当前主循环未调用它 |
| `_get_llm_response()` | 消费流式响应，返回可供判断和保存的完整文本 |

模板占位符分别为：`initial` 的 `{task}`；`reflect` 的 `{task}`、`{content}`；`refine` 的 `{task}`、`{last_attempt}`、`{feedback}`。自定义模板可省略不用的字段，但不能使用调用方未提供的字段名。

`max_iterations` 限制反思轮数，不包括初次执行。每轮可能包含一次反思和一次改进，模型调用最多为 `1 + 2 × max_iterations`。每次 `run()` 重置记忆；记录中的 execution 是模型生成的内容，不表示执行了生成代码。

当前仅完整匹配“无需改进”时停止，避免“不能认为无需改进”等文字导致误停；若输出“无需改进。”则仍会继续。默认模板已要求严格输出停止用语。

类中变量名与最终打印仍偏向代码任务，但默认提示词是通用模板，返回结果也可以是普通回答。当前反思由同一模型完成，不是运行程序或外部评测。

## 5. PlanAndSolveAgent

文件：`agents/plan_solve_agent.py`。由规划器和执行器组合实现。

| 组件 | 作用 |
|---|---|
| `Planner.plan(question)` | 请求模型生成计划，收集完整文本，再解析 Python 列表 |
| `Executor.execute(question, plan)` | 逐项求解，携带之前步骤结果，返回最后一步回答 |
| `PlanAndSolveAgent.run(question)` | 先规划，计划非空时再交给执行器 |

规划器从 `python` 围栏中提取列表，调用 `ast.literal_eval()` 解析字面量。它不执行任意 Python 代码，也不会自动运行列表中描述的任务。

执行器每一步请求同一个客户端，并将问题、计划、历史结果和当前步骤写入提示词。它的“执行”目前指模型解答，不是调用真实工具。

两处 `think()` 都需要消费并拼接文本：规划器要对完整文本调用 `.split()`，执行器要把真实回答写入步骤历史，而不是保存生成器对象。

当前边界：计划依赖特定围栏格式；只验证结果是列表，没有逐项验证字符串；空计划由 `run()` 拦截，但直接调用 `Executor.execute()` 传入空列表会使结果变量未赋值；最终答案直接采用最后一步响应，没有额外汇总请求。

## 6. 本地基础组件与测试入口

`core/agent.py` 定义抽象 `run()`、消息增删与历史浅拷贝；`core/message.py` 用 Pydantic 校验消息字段，`role: MessageRole` 将角色限制到 user、assistant、system、tool；`to_dict()` 只输出 role 和 content。

`core/config.py` 保存默认配置，但不会自动影响 `create_llm()`。例如它的默认服务仍为 Ollama，不会覆盖 `models.json` 中的 DeepSeek。`max_history_length` 当前只是字段，本地 Agent 的 `add_message()` 没有按它自动裁剪。

从项目根目录运行对应示例：

```powershell
python -X utf8 -m test.test_simple_agent
python -X utf8 -m test.test_reflection_agent
python -X utf8 -m test.test_plan_solve_agent
```

这些是包含真实模型请求的功能示例。判断工具是否工作，应检查实际工具结果；模型即使在工具失败后自行计算出答案，也不能说明工具分支通过。

## 7. 与新增工具编排的关系

`ToolChain` 和 `AsyncToolExecutor` 都通过注册表执行工具，但当前四种 Agent 没有导入或调用这两个模块。PlanAndSolveAgent 的 Executor 是模型逐步解题，也不等于线程池执行器或工具链。

工具链适合固定顺序与步骤结果传递，异步执行器适合独立任务并发。它们不会自动从模型输出生成步骤、自动调用模型总结，或把工具错误转换成可靠答案。具体关联与接入缺口见 [工具链与异步执行说明](工具链与异步执行说明.md)；搜索实现与验证范围见 [搜索工具与测试说明](搜索工具与测试说明.md)。

更细的图示见 [核心代码流程](flows/核心代码流程.md)。返回 [文档导航](文档导航.md)。
