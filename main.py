from core.llm import create_llm

# 默认服务和模型由项目根目录的 models.json 决定。
# 切换示例：create_llm(provider="modelscope")
llm = create_llm()
print(f"当前服务（provider）：{llm.provider}")
print(f"实际请求地址：{llm.base_url}")
print(f"使用模型：{llm.model}")

messages = [{"role": "user", "content": "你好，请介绍一下你自己。"}]

response_stream = llm.think(messages)

print(f"\n用户：{messages[-1]['content']}")
print("\n模型回复：")
for chunk in response_stream:
    pass
