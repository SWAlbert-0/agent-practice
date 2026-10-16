"""本地LLM客户端的离线测试，不连接任何模型服务。"""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

import core.llm as llm_module
from core.llm import LLM, create_llm


class FakeStream:
    def __init__(self, chunks):
        self.chunks = chunks
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.closed = True

    def __iter__(self):
        return iter(self.chunks)


def text_chunk(content):
    return SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=content))])


def completion(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


@pytest.fixture
def client(monkeypatch):
    sdk = MagicMock()
    monkeypatch.setattr(llm_module, "OpenAI", sdk)
    return LLM(
        provider="local", model="test-model", base_url="http://localhost:8000/v1",
        api_key="test-key", max_tokens=100, timeout=30,
    )


def test_invoke_returns_text_and_forwards_options(client, capsys):
    client._client.chat.completions.create.return_value = completion("answer")
    messages = [{"role": "user", "content": "question"}]

    assert client.invoke(messages, temperature=0, max_tokens=20, top_p=0.9) == "answer"
    client._client.chat.completions.create.assert_called_once_with(
        model="test-model", messages=messages, temperature=0, max_tokens=20,
        top_p=0.9, stream=False,
    )
    assert capsys.readouterr().out == ""


def test_invoke_handles_missing_text(client):
    client._client.chat.completions.create.return_value = completion(None)

    assert client.invoke([]) == ""


def test_invoke_rejects_streaming_mode(client):
    with pytest.raises(ValueError, match="stream_invoke"):
        client.invoke([], stream=True)
    client._client.chat.completions.create.assert_not_called()


def test_stream_is_lazy_and_skips_nontext_events(client, capsys):
    stream = FakeStream([
        SimpleNamespace(choices=[]), text_chunk(None), text_chunk(""),
        text_chunk("hello"), text_chunk(" world"),
    ])
    client._client.chat.completions.create.return_value = stream
    response = client.think([], temperature=0)
    client._client.chat.completions.create.assert_not_called()

    assert list(response) == ["hello", " world"]
    assert stream.closed
    assert client._client.chat.completions.create.call_args.kwargs["temperature"] == 0
    assert client._client.chat.completions.create.call_args.kwargs["stream"] is True
    assert "hello world" in capsys.readouterr().out


def test_stream_invoke_forwards_all_options(client):
    client._client.chat.completions.create.return_value = FakeStream([text_chunk("answer")])

    assert "".join(client.stream_invoke([], temperature=0.2, max_tokens=10, top_p=0.8)) == "answer"
    options = client._client.chat.completions.create.call_args.kwargs
    assert options["temperature"] == 0.2
    assert options["max_tokens"] == 10
    assert options["top_p"] == 0.8


def test_closing_generator_releases_stream(client):
    stream = FakeStream([text_chunk("first"), text_chunk("second")])
    client._client.chat.completions.create.return_value = stream
    response = client.think([])

    assert next(response) == "first"
    assert not stream.closed
    response.close()
    assert stream.closed


def test_stream_failure_releases_connection_and_propagates(client):
    def chunks():
        yield text_chunk("partial")
        raise RuntimeError("stream failed")

    stream = FakeStream(chunks())
    client._client.chat.completions.create.return_value = stream
    response = client.think([])
    assert next(response) == "partial"
    with pytest.raises(RuntimeError, match="stream failed"):
        next(response)
    assert stream.closed


def test_request_errors_propagate_without_framework_wrapper(client):
    client._client.chat.completions.create.side_effect = RuntimeError("request failed")

    with pytest.raises(RuntimeError, match="request failed"):
        client.invoke([])
    response = client.think([])
    with pytest.raises(RuntimeError, match="request failed"):
        next(response)


def test_timeout_and_optional_max_tokens(monkeypatch):
    sdk = MagicMock()
    monkeypatch.setattr(llm_module, "OpenAI", sdk)
    monkeypatch.setenv("LLM_TIMEOUT", "120")
    llm = LLM("model", "key", "http://localhost:8000/v1", "local")
    assert llm.timeout == 120
    sdk.assert_called_once_with(api_key="key", base_url="http://localhost:8000/v1", timeout=120)
    llm._client.chat.completions.create.return_value = completion("answer")
    llm.invoke([])
    assert "max_tokens" not in llm._client.chat.completions.create.call_args.kwargs
    llm.close()
    llm._client.close.assert_called_once()


@pytest.fixture
def model_config(tmp_path, monkeypatch):
    monkeypatch.setattr(llm_module, "OpenAI", MagicMock())
    monkeypatch.setattr(llm_module, "PROJECT_ROOT", tmp_path)
    monkeypatch.setenv("TEST_LLM_API_KEY", "process-key")
    (tmp_path / ".env").write_text("TEST_LLM_API_KEY=file-key\n", encoding="utf-8")
    config = {
        "defaultProvider": "cloud",
        "providers": {
            "cloud": {
                "defaultModel": "cloud-model", "baseUrl": "https://example.com/v1",
                "apiKeyEnv": "TEST_LLM_API_KEY",
            },
            "local": {
                "defaultModel": "local-model", "baseUrl": "http://localhost:8000/v1",
                "apiKey": "local",
            },
        },
    }
    (tmp_path / "models.json").write_text(json.dumps(config), encoding="utf-8")
    return tmp_path, config


def test_factory_default_and_environment_precedence(model_config):
    llm = create_llm()

    assert type(llm) is LLM
    assert (llm.provider, llm.model, llm.base_url, llm.api_key) == (
        "cloud", "cloud-model", "https://example.com/v1", "process-key",
    )


def test_factory_provider_and_model_override(model_config, monkeypatch):
    monkeypatch.delenv("TEST_LLM_API_KEY")
    llm = create_llm(provider="local", model="other-model")

    assert (llm.provider, llm.model, llm.api_key) == ("local", "other-model", "local")


def test_factory_custom_path_and_empty_key(model_config):
    root, config = model_config
    path = root / "custom.json"
    config["defaultProvider"] = "local"
    path.write_text(json.dumps(config), encoding="utf-8")
    assert create_llm(config_path=path).provider == "local"

    config["providers"]["local"]["apiKey"] = ""
    path.write_text(json.dumps(config), encoding="utf-8")
    with pytest.raises(ValueError):
        create_llm(config_path=path)
