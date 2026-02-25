## CloudPhone Plugin

OpenClaw CloudPhone 插件，用于为 Agent 提供 **CloudPhone 设备连接链路查询** 等自定义工具能力。

当前实现的主要功能：

- **调试工具 `echo`**：回显输入内容，验证插件和工具调用链路是否正常
- **设备连接链路查询 `get_device_connection_link`**：根据设备 ID 查询 SSH 连接命令、密码以及过期时间

---

### 目录结构

```
cloudphone/
├── openclaw.plugin.json   # 插件清单（id、configSchema、uiHints）
├── package.json           # npm 依赖 & 构建脚本
├── tsconfig.json          # TypeScript 编译配置
├── src/
│   ├── index.ts           # 插件入口，注册所有工具
│   └── tools.ts           # Agent 工具定义与实现
└── README.md
```

---

### 开发与构建

- **安装依赖**

```bash
npm install
```

- **开发模式（监听编译）**

```bash
npm run dev
```

- **生产构建**

```bash
npm run build
```

构建产物默认为 `dist/index.js`，并通过 `package.json` 中的 `openclaw.extensions` 暴露给 OpenClaw。

---

### 在 OpenClaw 中加载插件

- **方式一：链接模式（开发推荐）**

```bash
openclaw plugins install -l ./
```

- **方式二：扩展目录**

将整个目录复制（或软链接）到工作区：

```text
<workspace>/.openclaw/extensions/cloudphone/
```

或全局目录：

```text
~/.openclaw/extensions/cloudphone/
```

- **方式三：配置路径**

在 OpenClaw 配置中添加（指向构建后的入口文件）：

```json
{
  "plugins": {
    "load": {
      "paths": ["E:/cloudphone/dist/index.js"]
    }
  }
}
```

---

### 插件配置（`openclaw.plugin.json`）

插件配置位于 OpenClaw 配置的 `plugins.entries.cloudphone.config` 下，对应的 `configSchema` 为：

- `baseUrl`：CloudPhone API 基础地址，默认 `https://cptest.yaltc.cn`
- `token`：Bearer Token 鉴权凭证
- `timeout`：请求超时时间（毫秒），默认 `5000`

示例配置：

```json
{
  "plugins": {
    "entries": {
      "cloudphone": {
        "enabled": true,
        "config": {
          "baseUrl": "https://cptest.yaltc.cn",
          "token": "your-bearer-token",
          "timeout": 5000
        }
      }
    }
  }
}
```

| 字段       | 类型   | 必填 | 说明                                   |
|------------|--------|------|----------------------------------------|
| `baseUrl`  | string | 否   | CloudPhone API 基础地址，未配置时使用默认值   |
| `token`    | string | 否   | Bearer Token，用于访问受保护接口       |
| `timeout`  | number | 否   | 请求超时（ms），默认 `5000`           |

> 修改配置后通常需要重启 Gateway 才能生效。

---

### 已注册工具

所有工具都在 `src/tools.ts` 中定义，并在 `src/index.ts` 中通过 `api.registerTool` 注册。

| 工具名                            | 说明                                             |
|-----------------------------------|--------------------------------------------------|
| `echo`                        | 回显输入文本，用于验证工具调用是否正常          |
| `get_device_connection_link`  | 查询指定设备的 SSH 连接链路及过期时间           |

#### `echo`

- **用途**：调试用工具，确保 OpenClaw 已正确加载插件并能成功调用工具。
- **请求参数**：

```json
{
  "text": "hello"
}
```

- **返回示例**：

```json
{
  "echo": "hello"
}
```

#### `get_device_connection_link`

- **用途**：根据设备 ID 查询 SSH 连接链路信息。
- **后端 API**：
  - `GET {baseUrl}/webide/api/autojs-stream/device-connection-link/{deviceId}`
  - 鉴权：可选 `Authorization: Bearer <token>`
- **请求参数**：

```json
{
  "deviceId": "7593283098889067310"
}
```

- **成功返回示例（简化）**：

```json
{
  "ok": true,
  "deviceId": "7593283098889067310",
  "sshCommand": "ssh root@host -p 12345",
  "macSshCommand": "ssh root@host -p 12345",
  "sshPwd": "password",
  "expireTime": 1730000000,
  "expireAt": "2024-10-27T10:00:00.000Z",
  "traceId": "xxxx"
}
```

- **失败返回示例（简化）**：

```json
{
  "ok": false,
  "code": "xxx",
  "message": "错误信息",
  "traceId": "xxxx"
}
```

工具内部会根据配置自动：

- 选择 `baseUrl`（默认 `https://cptest.yaltc.cn`）
- 在配置了 `token` 时附带 `Authorization` 头
- 根据 `timeout` 做超时控制，并返回明确的错误信息

---

### 扩展：添加新工具

1. 在 `src/tools.ts` 中新增一个符合 `ToolDefinition` 接口的对象：

```typescript
const myTool: ToolDefinition = {
  name: "my_tool",          // 建议使用 snake_case
  description: "工具功能描述",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "输入参数" }
    },
    required: ["input"]
  },
  handler: async ({ input }, config) => {
    // 使用 config.baseUrl / config.token / config.timeout 实现业务逻辑
    return { result: input };
  }
};
```

2. 将新工具加入导出的 `tools` 数组：

```typescript
export const tools: ToolDefinition[] = [echoTool, getDeviceConnectionLinkTool, myTool];
```

3. 运行构建并重启 Gateway：

```bash
npm run build
```

> 重启后，OpenClaw 会自动根据插件导出的工具列表更新 Agent 可用工具。

