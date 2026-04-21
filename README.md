# Hermes Agent Chat UI

一个纯静态、极简、无依赖的 Chat Web UI，专门用于通过浏览器与远程 Hermes Agent 进行对话。基于 Claude 的暖赤陶色设计系统。

![screenshot](screenshot.png)

## ✨ 功能特点

- **纯静态架构**：无需 npm、webpack 或 vite 等任何构建工具，开箱即用。
- **优雅设计**：采用 Claude 风格的编辑式排版，严格遵循暖赤陶色（Terracotta）调色板。
- **完整 Markdown 支持**：支持代码高亮、一键复制代码块、表格、列表等复杂格式。
- **流式输出**：精准的 SSE 流式解析，丝滑的打字机光标动画效果。
- **移动端优先**：完美适配手机浏览器与安全区。
- **极致安全**：API 密钥仅存在于浏览器的 `localStorage` 中，所有通信直接通过你的设备发起。

## 🚀 快速开始

本项目无需任何编译，直接双击 `index.html` 即可在浏览器中预览。

1. 打开 [index.html](index.html)。
2. 点击右上角的 **齿轮(⚙️)** 图标进入设置。
3. 填入你的 Hermes API 地址（例如：`http://localhost:8642`）。
4. 填入你的 API 密钥（如果有）。
5. 点击**测试连接**，如果显示绿灯，即可开始对话！

> **URL 快速配置参数**：
> 也可以通过 URL 传参自动配置并测试连接：
> `https://your-domain.github.io/?api=http://192.168.1.100:8642&key=your-key`

## 🌍 部署到 GitHub Pages

此项目完美契合 GitHub Pages：

1. 将本仓库 Fork 到你的账号下，或创建一个新仓库并推送到远程。
2. 在 GitHub 仓库页面，进入 `Settings` -> `Pages`。
3. 将 `Source` 选为 `Deploy from a branch`。
4. 将分支选为 `main`，目录保留为 `/ (root)`，点击 `Save`。
5. 稍等片刻，你的聊天界面就在公网上线了！

## 🛠 服务端 (Orange Pi) 配合说明

要让网页能访问到你的后端，请确保服务端的配置允许跨域（CORS）：

1. **内网访问**：在同一局域网下，将 API 地址填为 Orange Pi 的内网 IP，例如 `http://192.168.31.50:8642`。
2. **公网访问（内网穿透）**：如果你使用了 Cloudflare Tunnels、FRP、Tailscale 或 ngrok 等穿透工具，请将配置的 API 地址填入对应公网 URL。
   *注意：使用 HTTPS 部署的前端（如 GitHub Pages）只能调用 HTTPS 的 API 接口。如果你内网穿透不支持 HTTPS，你可能需要将本页面部署在 HTTP 环境或直接本地打开。*

## 🔒 安全声明

- 你的 **API Key** 仅保存在当前浏览器的 `localStorage` 中。
- 所有的网络请求 (fetch) 都是从你的浏览器**直接**发送到你配置的 API 地址。
- 本项目不包含任何追踪代码、后端收集服务或数据上报机制。

## 📄 License

MIT License
