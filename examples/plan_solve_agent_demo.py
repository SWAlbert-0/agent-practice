from agents.plan_solve_agent import PlanAndSolveAgent
from core.llm import create_llm


def main():
    # 创建LLM实例
    llm = create_llm()

    # 创建自定义PlanAndSolveAgent
    # agent = PlanAndSolveAgent(
    #     name="我的规划执行助手",
    #     llm=llm
    # )
    agent = PlanAndSolveAgent(llm_client=llm)

    # 测试复杂问题
    question = "一个水果店周一卖出了15个苹果。周二卖出的苹果数量是周一的两倍。周三卖出的数量比周二少了5个。请问这三天总共卖出了多少个苹果？"

    result = agent.run(question)
    print(f"\n最终结果: {result}")


if __name__ == "__main__":
    main()
