"""只提供 web 目录的本地静态预览，启动时刷新源码索引。"""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from generate_sources import WEB_ROOT, generate, generate_diagrams


class PreviewHandler(SimpleHTTPRequestHandler):
    """本地开发预览每次重新验证资源，避免旧 CSS / 模块掩盖修改。"""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5173)
    args = parser.parse_args()
    generate()
    generate_diagrams()
    handler = partial(PreviewHandler, directory=str(WEB_ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Agent 架构与流程演示: http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
