#!/usr/bin/env python3
"""BoaBite 静态服务（no-cache 版）：所有响应禁缓存，杜绝浏览器/代理缓存旧页面"""
import http.server
import socketserver
import os

PORT = int(os.environ.get("PORT", "3131"))
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def translate_path(self, path):
        # 相对工作区根目录
        p = super().translate_path(path)
        return p


os.chdir(ROOT)

socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
    print(f"[serve] no-cache static on :{PORT} root={ROOT}")
    httpd.serve_forever()
