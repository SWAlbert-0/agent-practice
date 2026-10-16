"""消息系统"""
from typing import Optional, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel

# 定义消息角色的类型，限制其取值
MessageRole = Literal["user", "assistant", "system", "tool"]

class Message(BaseModel):
    """消息类"""

    content: str  # 消息内容
    role: MessageRole  # 消息角色
    timestamp: datetime = None  # 消息时间戳
    metadata: Optional[Dict[str, Any]] = None  # 可选的元数据

    def __init__(self, content: str, role: MessageRole, **kwargs):
        super().__init__(
            content=content, 
            role=role, 
            timestamp = kwargs.get("timestamp", datetime.now()),
            metadata = kwargs.get("metadata", {})
        )

    # 核心功能之一，负责将内部使用的 Message 对象转换为与 OpenAI API 兼容的字典格式
    # 体现了“对内丰富，对外兼容”的设计原则
    def to_dict(self) -> Dict[str, Any]:
        """将消息对象转换为字典"""
        return {
            "content": self.content,
            "role": self.role,
        }

    def __str__(self) -> str:
        return f"[{self.role}] {self.content}" 