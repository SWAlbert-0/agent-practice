"""本地ReAct流程的离线测试，不请求模型服务。"""

import pytest

from agents.react_agent import ReActAgent
from core.agent import Agent
from core.config import Config
from core.message import Message
from tools.calculator_tool import CalculatorTool
from tools.registry import ToolRegistry


class FakeLLM:
    provider = "offline"

    def __init__(self, responses):
        self.responses = iter(responses)
        self.requests = []

    def invoke(self, messages, **kwargs):
        self.requests.append((messages, kwargs))
        return next(self.responses)


def test_local_base_and_initialization():
    llm = FakeLLM([])
    registry = ToolRegistry()
    config = Config(debug=True)
    agent = ReActAgent("test", llm, registry, system_prompt="system", config=config)

    assert ReActAgent.__bases__ == (Agent,)
    assert agent.llm is llm
    assert agent.tool_registry is registry
    assert agent.config is config
    assert agent.system_prompt == "system"
    assert agent.get_history() == []


def test_direct_finish_and_local_message_history():
    llm = FakeLLM(["Thought: ready\nAction: Finish[answer]"])
    agent = ReActAgent("test", llm, ToolRegistry())

    assert agent.run("question", temperature=0) == "answer"
    assert llm.requests[0][1] == {"temperature": 0}
    history = agent.get_history()
    assert [(message.role, message.content) for message in history] == [
        ("user", "question"), ("assistant", "answer")
    ]
    assert all(isinstance(message, Message) for message in history)
    agent.clear_history()
    assert agent.get_history() == []


def test_calculator_result_reaches_next_model_request():
    llm = FakeLLM([
        "Thought: calculate\nAction: calculator[15 * 8 + 32]",
        "Thought: done\nAction: Finish[152]",
    ])
    registry = ToolRegistry()
    registry.register_tool(CalculatorTool())
    agent = ReActAgent("test", llm, registry)

    assert agent.run("calculate") == "152"
    assert "Observation: 152" in llm.requests[1][0][0]["content"]
    assert len(agent.get_history()) == 2


def test_step_limit_and_current_task_reset():
    llm = FakeLLM([
        "Thought: working\nAction: echo[first]",
        "Thought: done\nAction: Finish[second]",
    ])
    registry = ToolRegistry()
    registry.register_function("echo", "echo input", lambda text: text)
    agent = ReActAgent("test", llm, registry, max_steps=1)

    assert agent.run("first question") == "抱歉，我无法在限定步数内完成这个任务。"
    assert len(llm.requests) == 1
    assert agent.current_history
    assert agent.run("second question") == "second"
    assert agent.current_history == []
    assert "Observation: first" not in llm.requests[1][0][0]["content"]


@pytest.mark.parametrize("text, expected", [
    ("Thought: reason\nAction: Finish[done]", ("reason", "Finish[done]")),
    ("Thought: reason", ("reason", None)),
    ("unstructured response", (None, None)),
])
def test_output_parser(text, expected):
    agent = ReActAgent("test", FakeLLM([]), ToolRegistry())

    assert agent._parse_output(text) == expected


def test_action_parser_and_finish_input():
    agent = ReActAgent("test", FakeLLM([]), ToolRegistry())

    assert agent._parse_action("calculator[sqrt(16)]") == ("calculator", "sqrt(16)")
    assert agent._parse_action_input("Finish[answer]") == "answer"
    assert agent._parse_action("invalid") == (None, None)
    assert agent._parse_action_input("invalid") == ""
