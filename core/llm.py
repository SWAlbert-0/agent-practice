"""根据 models.json 中的一组配置创建模型客户端。"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from hello_agents import HelloAgentsLLM


# 通过文件位置找到项目根目录，不依赖终端的当前目录。
PROJECT_ROOT = Path(__file__).resolve().parents[1]


def create_llm(
    provider: str | None = None,
    model: str | None = None,
    *,
    config_path: str | Path | None = None,
) -> HelloAgentsLLM:
    """显式参数优先，否则使用配置文件中的默认服务和模型。

    config_path 可指定其他 JSON 文件，默认读取项目根目录的 models.json。
    .env 始终从项目根目录加载，且不覆盖进程中已有的环境变量。
    """
    # 1. 加载密钥和服务配置。
    load_dotenv(PROJECT_ROOT / ".env")
    path = Path(config_path) if config_path is not None else PROJECT_ROOT / "models.json"
    config = json.loads(path.read_text(encoding="utf-8-sig"))

    # 2. 选择服务，再读取该服务的模型和连接参数。
    provider = provider or config["defaultProvider"]
    settings = config["providers"][provider]
    model = model or settings["defaultModel"]
    base_url = settings["baseUrl"]

    # 3. 云端密钥从环境变量读取，本地服务使用配置中的占位密钥。
    if "apiKeyEnv" in settings:
        api_key = os.environ[settings["apiKeyEnv"]]
    else:
        api_key = settings["apiKey"]

    # 空密钥会让基础类尝试读取其他配置，因此这里保留一个必要检查。
    if not api_key:
        raise ValueError(f"{provider} 的 API 密钥不能为空")

    # 4. 显式传入整组参数，避免基础类自动检测时混用不同服务的配置。
    return HelloAgentsLLM(
        provider=provider,
        model=model,
        base_url=base_url,
        api_key=api_key,
    )
