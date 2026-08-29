#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rep-workbench 的 Render 一键部署脚本
前置：
  1. 在 https://dashboard.render.com/account/api-keys 生成 API Key
  2. 设置环境变量 RENDER_API_KEY（Windows PowerShell: $env:RENDER_API_KEY="rnd_xxx"）
  3. 确认已在 Render 中 Connect GitHub 并授权 Anson1209 账号
运行：python render_deploy.py
脚本会：获取 owner -> 创建 web service（等价于 render.yaml 配置）-> 输出公网地址
"""
import os
import sys
import json
import urllib.request
import urllib.error

API = "https://api.render.com/v1"


def _req(method, path, body=None):
    url = API + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + os.environ["RENDER_API_KEY"])
    req.add_header("Accept", "application/json")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print("HTTPError", e.code, e.read().decode("utf-8", "ignore"))
        sys.exit(1)


def main():
    key = os.environ.get("RENDER_API_KEY")
    if not key:
        print("缺少 RENDER_API_KEY 环境变量。请先生成 Render API Key 并设置。")
        sys.exit(1)

    owners = _req("GET", "/owners")
    print("owners 响应:", json.dumps(owners, ensure_ascii=False)[:500])
    owner_id = None
    if isinstance(owners, list):
        owner_id = owners[0].get("id") or owners[0].get("owner", {}).get("id")
    elif isinstance(owners, dict):
        owner_id = owners.get("id")
    if not owner_id:
        print("无法解析 ownerId，请检查上方响应。")
        sys.exit(1)
    print("ownerId =", owner_id)

    payload = {
        "type": "web",
        "name": "rep-workbench",
        "ownerId": owner_id,
        "repo": "https://github.com/Anson1209/rep-workbench",
        "branch": "main",
        "runtime": "node",
        "plan": "free",
        "buildCommand": "npm install",
        "startCommand": "node server.js",
        "healthCheckPath": "/api/stats",
        "autoDeploy": True,
        "envVars": [{"key": "NODE_VERSION", "value": "22"}],
    }
    svc = _req("POST", "/services", payload)
    print("创建结果:", json.dumps(svc, ensure_ascii=False)[:800])
    print("\n✅ 已提交部署。几分钟后公网地址可用：")
    print("   https://rep-workbench.onrender.com")
    print("   部署状态请在 dashboard.render.com 查看。")


if __name__ == "__main__":
    main()
