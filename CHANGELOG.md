# 更新日志

本项目的所有重要变更都记录在此文件中。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [2.0.0] - 2026-09-29

更名与全面重构版本（前身为 JZX Lite 百宝箱 v1.0.0）。

### 变更

- **品牌更名**：JZX Lite 百宝箱 → 阿苏工具箱，图标、界面、通知全面换新
- **Service Worker 模块化重构**：按 CONFIG / MENUS / NOTIFY / RPC / QR /
  HANDLERS / PROXY / MESSAGING 分区，统一命名与错误处理
- **消息总线规范化**：popup/options/offscreen 消息键统一为 `asu*` 前缀
- **修复**：offscreen 解码等待器由"每次注册监听"改为"单监听 + 待决表"，
  消除并发扫描时的监听器堆积
- **修复**：popup 代理开关移除临时字段 hack，状态显示与实际模式始终一致
- **修复**：二维码工具页识别结果样式类污染问题
- manifest 新增 `homepage_url`、`short_name`、`author`、`minimum_chrome_version`

### 兼容性

- 配置结构完全兼容 1.x，升级无需重新配置

## [1.0.0] - 2026-09-29

首个公开版本（时名 JZX Lite 百宝箱）。

### 新增

- 右键菜单工具集：二维码生成（选区/链接/页面）、二维码识别与跳转（jsQR）、
  百度识图、谷歌 Lens 以图搜图
- 下载：浏览器下载、Aria2 JSON-RPC 推送、Motrix JSON-RPC 推送
  （自动附带 Referer 与站点 Cookie）
- 隐私工具：显示/隐藏明文密码、Cookie 工具（请求头 / Netscape / JSON 导出与清空）
- 网盘聚合搜索（URL 模板可自定义）
- 自定义脚本：页面上下文执行，保存后成为右键菜单项
- 代理管理器：固定服务器 / PAC 订阅 URL / 域名分流规则三种模式，
  支持绕过列表、出口 IP 查询、弹窗一键开关
- 设置页：菜单逐项开关、RPC 连接测试、设置导出与恢复
- 隐私承诺：无统计、无埋点、无远程脚本

[2.0.0]: https://github.com/poboll/asu-toolbox/releases/tag/v2.0.0
[1.0.0]: https://github.com/poboll/asu-toolbox/releases/tag/v1.0.0
