# WP Panel 助手（WP Panel Assistant）

WP Panel 助手是一个 Windows 桌面软件，帮你连接自己的 VPS 服务器，一键安装 [WP Panel](https://github.com/naibabiji/wp-panel)，并提供忘记密码、重启面板等常用操作。它基于开源 SSH 客户端 [Tabby](https://github.com/Eugeny/tabby) 开发，也可以当作普通的 SSH / SFTP 客户端使用。界面支持简体中文和英文。

[English](#english)

## 功能

- **安装 WP Panel**：填写服务器地址、端口、用户名和密码，确认后自动执行 WP Panel 官方安装命令（先检查服务器环境，通过后再安装）。安装过程在终端中完整可见；断线后可以恢复安装进度。
- **管理 WP Panel**：查看面板地址、忘记登录密码、解除 IP 封禁、重启面板、诊断检查、查看日志。
- **SSH / SFTP**：保留 Tabby 的终端和文件传输功能。

## 下载

- GitHub：[Releases](https://github.com/naibabiji/wp-panel-assistant/releases)
- 官网（含国内网盘下载）：<https://wp-panel.org/assistant/>
- 隐私政策：<https://wp-panel.org/assistant/privacy/>

下载后可以用 Release 页面提供的 SHA256 校验值核对安装包。

## 使用要求

- 电脑：Windows 10 或 Windows 11（64 位）。
- 服务器：Debian 13（64 位 x86），建议是刚重装好的全新系统。
- 云服务器需要在服务商的安全组中放行 8443 端口，否则面板打不开。

## 安全与隐私

- **不上传任何数据**：不收集使用统计，不上报崩溃，不上传服务器信息、密码或终端内容。
- **只连接你自己的服务器**：软件主动发起的连接只有 SSH 连接和面板端口（8443）检测。唯一的例外是检查更新：启动时读取本仓库的公开版本信息文件 `latest.json`，不发送任何设备信息，可以在首页关闭。
- **密码**：服务器信息保存在本机；勾选"记住密码"时，密码保存在 Windows 凭据管理器中，只有登录成功后才保存。
- **服务器指纹**：第一次连接时需要你确认服务器指纹；指纹变化时默认断开连接，不会静默接受。
- **命令可见**：只执行界面上显示给你的命令（WP Panel 官方安装命令和 `wpp` 常用命令）。重置密码、重新安装等操作执行前都会再次确认。
- 与 Tabby 原版相比，移除了统计、崩溃上报、自动更新、插件市场和配置云同步。

## 升级

有新版本时，软件首页会提示。下载新安装包直接安装即可，设置、已保存的服务器和记住的密码都会保留。

## 从源码构建

需要 Windows、Node.js 22、yarn、Visual Studio 2022（C++ 桌面开发）和 Rust。构建步骤与 `.github/workflows/release.yml` 相同：

```powershell
cd tabby
yarn
yarn run build
node scripts/prepackage-plugins.mjs
node ../tools/generate-license-files.cjs
node scripts/build-windows.mjs
```

助手自己的代码在 `tabby/tabby-wp-panel/`，其余为 Tabby 源码及少量必要修改。

## 反馈

- GitHub：[Issues](https://github.com/naibabiji/wp-panel-assistant/issues)
- 邮箱：blog@naibabiji.com
- 微信：vv15_zhi（可拉你进入 WP Panel 交流群）

反馈时请提供软件版本（首页底部）和操作步骤。**截图前请遮住密码**，不要把面板密码、服务器密码发给任何人。

## 许可证

本项目以 [GPL-3.0](LICENSE) 发布。基于 Tabby（MIT 许可证，版权声明见 `tabby/LICENSE`）。安装目录中附带全部第三方组件的许可证。

---

## English

WP Panel Assistant is a Windows desktop app that connects to your own VPS, installs [WP Panel](https://github.com/naibabiji/wp-panel) with one click, and provides common actions such as resetting the login password and restarting the panel. It is based on the open-source SSH client [Tabby](https://github.com/Eugeny/tabby) and can also be used as a regular SSH / SFTP client. The UI is available in Simplified Chinese and English.

- **Download**: [Releases](https://github.com/naibabiji/wp-panel-assistant/releases) or <https://wp-panel.org/assistant/>. Privacy policy: <https://wp-panel.org/assistant/privacy/>.
- **Requirements**: Windows 10/11 (64-bit); server running Debian 13 (x86_64); port 8443 open in your cloud firewall.
- **Privacy**: no telemetry, no crash reporting, nothing uploaded. The app connects only to your server (SSH and a check of port 8443), plus an update check that reads the public `latest.json` file of this repository (no device information sent; can be turned off on the home page). Remembered passwords are stored in Windows Credential Manager, and only after a successful login. Unknown or changed server fingerprints are never accepted silently.
- **Feedback**: [Issues](https://github.com/naibabiji/wp-panel-assistant/issues) or blog@naibabiji.com.
- **License**: GPL-3.0. Based on Tabby (MIT).
