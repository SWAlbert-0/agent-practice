"""本地LLM客户端，以及根据models.json创建客户端的配置工厂。"""

import json
import os
from pathlib import Path
from typing import Any, Iterator

from dotenv import load_dotenv
from openai import OpenAI


# 通过文件位置找到项目根目录，不依赖终端的当前目录。
PROJECT_ROOT = Path(__file__).resolve().parents[1]


class LLM:
    """本地实现的OpenAI兼容客户端，供Agent统一调用。"""

    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str,
        provider: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ):
        # 连接信息由调用方明确提供，不自动猜测服务商或读取其他服务的密钥。
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.provider = provider
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout if timeout is not None else float(os.getenv("LLM_TIMEOUT", "60"))
        self._client = OpenAI(api_key=api_key, base_url=base_url, timeout=self.timeout)

    def _request(self, messages: list[dict[str, Any]], stream: bool, options: dict[str, Any]):
        """组织两种调用共用的参数，调用时的选项优先于实例默认值。"""
        parameters = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
        }
        if self.max_tokens is not None:
            parameters["max_tokens"] = self.max_tokens
        parameters.update(options)
        # 返回值类型由调用入口决定，避免invoke误收到流式响应。
        parameters["stream"] = stream
        return self._client.chat.completions.create(**parameters)

    def invoke(self, messages: list[dict[str, Any]], **kwargs) -> str:
        """非流式调用，等待完整回答后返回文本，不主动打印。"""
        if kwargs.pop("stream", False):
            raise ValueError("流式调用请使用think()或stream_invoke()")
        response = self._request(messages, stream=False, options=kwargs)
        return response.choices[0].message.content or ""

    def think(
        self,
        messages: list[dict[str, Any]],
        temperature: float | None = None,
        **kwargs,
    ) -> Iterator[str]:
        """迭代时才发送流式请求，实时打印并逐段返回文本。"""
        if temperature is not None:
            kwargs["temperature"] = temperature
        print(f"🧠 正在调用 {self.model} 模型...")

        # 上下文管理器在迭代结束、异常或生成器关闭时释放响应连接。
        with self._request(messages, stream=True, options=kwargs) as response:
            for chunk in response:
                # 用量等事件可能没有choices；角色或结束事件可能没有正文。
                if not chunk.choices:
                    continue
                content = chunk.choices[0].delta.content
                if content:
                    print(content, end="", flush=True)
                    yield content
        print()

    def stream_invoke(self, messages: list[dict[str, Any]], **kwargs) -> Iterator[str]:
        """流式调用的兼容入口，将选项和文本片段交给think处理。"""
        yield from self.think(messages, **kwargs)

    def close(self) -> None:
        """不再使用客户端时，关闭SDK持有的连接。"""
        self._client.close()


def create_llm(
    provider: str | None = None,
    model: str | None = None,
    *,
    config_path: str | Path | None = None,
) -> LLM:
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

    # 尽早指出选中服务缺少密钥，不发送无效请求。
    if not api_key:
        raise ValueError(f"{provider} 的 API 密钥不能为空")

    # 4. 显式传入整组参数，创建本地客户端。
    return LLM(
        provider=provider,
        model=model,
        base_url=base_url,
        api_key=api_key,
    )
