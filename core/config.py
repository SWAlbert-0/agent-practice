"""配置管理"""
import os
from typing import Optional, Dict, Any
from pydantic import BaseModel

class Config(BaseModel):
    """配置类"""

    # LLM配置
    default_model: str = "qwen3.5:4b"  # 默认模型
    default_provider: str = "ollama"  # 默认服务提供商
    temperature: float = 0.7  # 温度参数
    max_tokens: Optional[int] = None  # 最大令牌数

    # 系统配置
    debug: bool = False  # 调试模式
    log_level: str = "INFO"  # 日志级别

    # 其他配置
    max_history_length: int = 100  # 最大历史记录长度

    # 允许用户通过设置环境变量来覆盖默认配置，无需修改代码，这在部署到不同环境时尤其有用
    @classmethod
    def from_env(cls) -> "Config":
        """从环境变量加载配置"""
        return cls(
            debug = os.getenv("DEBUG", "false").lower() == "true",
            log_level = os.getenv("LOG_LEVEL", "INFO"),
            temperature = float(os.getenv("TEMPERATURE", 0.7)),
            max_tokens = int(os.getenv("MAX_TOKENS")) if os.getenv("MAX_TOKENS") else None,
        )

    def to_dict(self) -> Dict[str, Any]:
        """将配置对象转换为字典"""
        return self.dict()