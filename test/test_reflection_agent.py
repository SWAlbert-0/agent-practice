# test_reflection_agent.py
from agents.reflection_agent import ReflectionAgent
from core.llm import create_llm


# 创建LLM实例
llm = create_llm()

# 使用默认通用提示词
general_agent = ReflectionAgent(name="我的反思助手", llm=llm)

# 使用自定义代码生成提示词（类似第四章）
code_prompts = {
    "initial": "你是Python专家，请编写函数:{task}",
    "reflect": "请审查代码的算法效率:\n任务:{task}\n代码:{content}\n"
               "如果代码已经满足要求，请仅输出\"无需改进\"，不要添加标点、解释或其他文字。"
               "否则请指出具体问题和改进建议。",
    "refine": "请根据反馈优化代码:\n任务:{task}\n反馈:{feedback}"
}
code_agent = ReflectionAgent(
    name="我的代码生成助手",
    llm=llm,
    custom_prompts=code_prompts
)

result = code_agent.run("编写一个函数，接收整数列表，返回去重后按升序排列的列表")

print(f"最终结果: {result}")
