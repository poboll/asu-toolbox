# JZX Lite 百宝箱

<div align="center">

**一个扩展，一揽子服务 —— 集装箱（Chrome 应用商店版）的精神续作**

[![Version](https://img.shields.io/badge/version-1.0.0-f58220.svg)](CHANGELOG.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285f4.svg)](https://developer.chrome.com/docs/extensions/develop/migrate)
[![License: MIT](https://img.shields.io/badge/License-MIT-18a058.svg)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome%2FArc%2FEdge-%E2%89%A5111-000000.svg)](https://developer.chrome.com/docs/extensions)

*纯本地运行 · 无远程依赖 · 不收集任何数据*

[立即下载](../../releases/latest) · [安装教程](#-安装) · [功能总览](#-功能总览) · [配置指南](#-配置指南) · [常见问题](#-常见问题) · [在线主页](https://xiaoshenming.github.io/jzx-lite/)

</div>

---

## 📖 这是什么

「集装箱」曾是很多人的浏览器标配，但它的远程应用商店后端（api.newday.me）已于 2026 年停止服务，叠加 Chrome 淘汰 Manifest V2，原版彻底无法使用。

**JZX Lite** 按 Manifest V3 标准重写了它的核心能力：右键菜单工具集（二维码生成 / 二维码识别 / 以图搜图 / 下载推送 / 显示密码 / Cookie 管理 / 网盘搜索 / 自定义脚本）加一个通用代理管理器。所有功能**打包即用、全部在本地执行**，没有任何需要联网的远程脚本或统计埋点。

> 本项目与原「集装箱」（哩呵 @ newday.me）无代码关联、无官方关系，仅致意与致敬。

## ✨ 功能总览

安装后在网页上 **点击右键** 即可使用（全部可在设置中开关）：

| 分组 | 菜单项 | 说明 |
|---|---|---|
| 📷 二维码 | 生成选区二维码 | 选中任意文字 → 弹出二维码，可下载 PNG / 复制图片 |
| | 生成链接/页面二维码 | 对链接、页面、音视频地址生成二维码 |
| | 识别图片二维码 | 右键图片 → 自动下载解码 → 结果复制到剪贴板 |
| | 识别二维码并跳转 | 同上，识别结果是链接时直接打开 |
| 🔍 以图搜图 | 百度识图 / 谷歌 Lens | 右键图片，一键以图搜图 |
| ⬇️ 下载 | 使用浏览器下载 | 交给浏览器下载管理器 |
| | 推送到 Aria2 | JSON-RPC 推送到本地/远程 Aria2（默认 6800 端口） |
| | 推送到 Motrix | 推送到 Motrix（默认 16800 端口），自动附带 Referer 与本站 Cookie |
| 🔒 隐私 | 显示/隐藏明文密码 | 一键切换页面密码框明文（再次点击还原） |
| | Cookie 工具 | 列出当前站点 Cookie，一键导出「请求头 / Netscape / JSON」三种格式，支持清空 |
| 🌐 搜索 | 网盘聚合搜索 | 选中资源名右键，直达网盘搜索引擎（模板可自定义） |
| 🧩 扩展性 | 执行自定义脚本 | 在设置里写 JS，保存后作为右键菜单项在页面上下文执行 |
| 🛡 代理 | 代理管理器 | 固定服务器 / PAC 订阅 URL / 域名分流规则三种模式，弹窗一键开关，可查出口 IP |

工具栏弹窗还提供：代理总开关、显示本页密码、页面二维码、二维码工具页、Cookie 工具页的快捷入口。

## 📥 安装

> Chrome / Arc / Edge 等所有 Chromium 内核浏览器（需 ≥ 111），以及大多数国产浏览器。

### 方式一：下载 Release（推荐）

1. 前往 [Releases](../../releases/latest) 下载 `jzx-lite-v1.0.0.zip`；
2. 解压到一个**长期保留**的目录（扩展以开发者模式加载，解压目录就是本体）；
3. 打开浏览器的扩展管理页（地址栏输入 `chrome://extensions`）；
4. 打开右上角 **开发者模式**；
5. 点击 **加载已解压的扩展程序**，选择解压出的文件夹；
6. 完成。右键任意网页即可看到新菜单。

### 方式二：克隆本仓库

```bash
git clone https://github.com/xiaoshenming/jzx-lite.git
```

然后在扩展管理页「加载已解压的扩展程序」选择仓库目录即可。

### 更新

覆盖文件夹内容后，到扩展管理页点击 JZX Lite 卡片上的 **重新加载** 按钮。

## ⚙️ 配置指南

右键菜单 → **JZX Lite 设置**，或点工具栏图标 → ⚙ 全部设置。

<details>
<summary><b>推送下载到 Aria2 / Motrix</b>（点击展开）</summary>

1. 确保本机已运行 Aria2（RPC 端口默认 `6800`）或 Motrix（RPC 端口默认 `16800`）；
2. 打开设置 → 下载推送，填入 RPC 地址与密钥（都没有就留空）；
3. 点击「测试连接」，看到版本号即成功；
4. 在任意下载链接上右键 → 推送。

推送时会自动携带当前页面的 Referer 与本站 Cookie，对需要鉴权的直链更友好。
</details>

<details>
<summary><b>配置代理</b>（点击展开）</summary>

三种模式按需选择：

- **固定代理服务器**：所有流量走同一台代理（如本机 Clash/V2Ray 的 `127.0.0.1:7890`）；
- **PAC 订阅 URL**：填任意可访问的 PAC 地址，扩展自动拉取并应用；
- **域名分流规则**：一行一条 `域名 代理主机 端口 [协议]`，例如

  ```
  *.google.com 127.0.0.1 7890
  tensorflow.org 127.0.0.1 7890 socks5
  ```

绕过列表默认包含 `localhost, 127.0.0.1, <local>`。设置页可一键「查看当前出口 IP」验证是否生效。
</details>

<details>
<summary><b>添加自定义脚本</b>（点击展开）</summary>

设置 → 自定义脚本 → 新建，写好名称与 JS 代码并保存，之后在页面右键 →「▶ 脚本名」即可执行。

- 脚本运行在页面上下文（MAIN world），受目标站点 CSP 限制；
- 复杂的注入需求建议使用 [脚本猫](https://scriptcat.org/) / 篡改猴 等成熟管理器。
</details>

## ❓ 常见问题

<details>
<summary>右键菜单没有出现？</summary>

确认扩展已启用（扩展管理页开关为蓝色）；到设置页把对应菜单项打开；仍不出现就到扩展管理页点「重新加载」。
</details>

<details>
<summary>识别图片二维码失败？</summary>

需要扩展能直接下载到图片字节：防盗链图（微信、部分电商图床）可能被拒绝；跨域 canvas 受污染的图也会失败。可先把图片另存为本地，再在「二维码工具」页上传识别。
</details>

<details>
<summary>百度识图打开后没有结果？</summary>

百度接口按图片 URL 提交，防盗链图会失败。谷歌 Lens（`uploadbyurl`）对直链更宽容，建议优先使用。
</details>

<details>
<summary>推送到 Aria2/Motrix 失败？</summary>

九成是服务没启动或地址/密钥不对。Motrix 请在其「设置 → 进阶」里确认 RPC 端口与密钥，并与扩展设置保持一致。
</details>

<details>
<summary>和原「集装箱」是什么关系？会做应用商店吗？</summary>

没有关系，也不做远程应用商店 —— 那正是原版停服的根源。JZX Lite 的哲学是：功能内置、开箱即用、一切在本地。
</details>

## 🗺 路线图

- [ ] 百度/搜狗搜索结果净化（去广告、直链还原）
- [ ] 网页限制解除（复制/右键/选择）
- [ ] 划词翻译深链（聚合多家引擎）
- [ ] Cookie 工具支持按条编辑
- [ ] Firefox (MV3) 适配

欢迎提 [Issue](../../issues) 与 PR。

## 🧾 隐私

- 不收集、不上传任何数据；无统计、无埋点、无远程脚本；
- 所有设置存储在浏览器本地的 `chrome.storage.sync`；
- 唯一的网络请求发生在你主动触发时：下载待识别图片、访问你填写的 RPC/PAC 地址、打开你点击的搜索/识图链接。

详见 [PRIVACY.md](PRIVACY.md)。

## 🙏 致谢

- [集装箱](https://chrome.zzzmh.cn/info/kbgigmcnifmaklccibmlepmahpfdhjch)（哩呵）—— 功能形态的灵感来源
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)（MIT）—— 二维码生成
- [jsQR](https://github.com/cozmo/jsQR)（Apache-2.0）—— 二维码识别
- [Reamd7/notion-zh_CN](https://github.com/Reamd7/notion-zh_CN) 等开源社区的先行者们

第三方组件许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与 `vendor/LICENSES/`。

## 📄 许可证

[MIT](LICENSE) © 2026 xiaoshenming。`vendor/` 目录内第三方组件依其原始许可证授权。
