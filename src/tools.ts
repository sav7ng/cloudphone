/**
 * Agent 工具定义模块
 *
 * 每个工具需包含：
 *   - name:        snake_case 格式的工具名
 *   - description: 向 AI Agent 说明工具用途
 *   - parameters:  JSON Schema 描述入参结构
 *   - execute:     执行函数，接收 (id, params)，返回 MCP Content 格式结果
 *
 * 官方文档：https://docs.openclaw.ai/plugins/agent-tools
 */

/** 插件配置类型（与 openclaw.plugin.json configSchema 保持一致） */
export interface CloudphonePluginConfig {
  baseUrl?: string;
  token?: string;
  timeout?: number;
}

/** MCP Content 项 */
export interface McpContentItem {
  type: "text";
  text: string;
}

/** MCP 风格的工具返回值 */
export interface McpToolResult {
  content: McpContentItem[];
}

/** 工具定义类型（与 OpenClaw api.registerTool 参数对齐） */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (id: string, params: Record<string, unknown>) => Promise<McpToolResult>;
}

/** 带配置功能的工具扩展类型 */
export interface ToolWithConfig extends ToolDefinition {
  _config: CloudphonePluginConfig;
  setConfig: (config: CloudphonePluginConfig) => void;
}

/** CloudPhone API 设备连接链路响应体类型 */
interface DeviceConnectionLinkResponse {
  code: string;
  message: string;
  traceId: string;
  success: boolean;
  data: {
    deviceId: string;
    sshCommand: string | null;
    macSshCommand: string | null;
    sshPwd: string | null;
    expireTime: number;
  } | null;
}

/**
 * 调试工具：echo
 * 原样返回输入内容，用于验证工具调用链路是否正常。
 */
const echoTool: ToolDefinition = {
  name: "cloudphone_echo",
  description: "将输入的文本原样返回，用于验证工具调用是否正常。",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "需要回显的文本内容",
      },
    },
    required: ["text"],
  },
  execute: async (_id, { text }) => {
    return { content: [{ type: "text", text: String(text) }] };
  },
};

/**
 * 工具：cloudphone_get_device_connection_link
 * 查询指定设备的 SSH 连接链路信息。
 *
 * API: GET {baseUrl}/webide/api/autojs-stream/device-connection-link/{deviceId}
 * Auth: Bearer Token
 */
const getDeviceConnectionLinkTool: ToolWithConfig = {
  name: "cloudphone_get_device_connection_link",
  description:
    "查询指定设备的 SSH 连接链路信息，返回 SSH 连接地址（host:port）和链路过期时间。需要提供设备 ID。",
  parameters: {
    type: "object",
    properties: {
      deviceId: {
        type: "string",
        description: "设备 ID，如 7593283098889067310",
      },
    },
    required: ["deviceId"],
  },
  // 通过闭包接收配置
  _config: {} as CloudphonePluginConfig,
  setConfig(config: CloudphonePluginConfig) {
    this._config = config;
  },
  execute: async (_id, { deviceId }) => {
    const config = getDeviceConnectionLinkTool._config;
    const base = config.baseUrl ?? "https://cptest.yaltc.cn";
    const timeout = config.timeout ?? 5000;
    const url = `${base}/webide/api/autojs-stream/device-connection-link/${String(deviceId)}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.token) {
      headers["Authorization"] = `Bearer ${config.token}`;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let body: DeviceConnectionLinkResponse;

    try {
      const controller =
        typeof AbortController !== "undefined" ? new AbortController() : undefined;
      if (controller) {
        timer = setTimeout(() => controller.abort(), timeout);
      }

      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller?.signal,
      });

      if (!res.ok) {
        const result = { ok: false, httpStatus: res.status, message: `HTTP 错误：${res.status} ${res.statusText}` };
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      }

      body = (await res.json()) as DeviceConnectionLinkResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result = { ok: false, message: `请求失败：${message}` };
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }

    if (!body.success || body.code !== "1") {
      const result = { ok: false, code: body.code, message: body.message, traceId: body.traceId };
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    }

    // 直接返回完整 API 响应
    return { content: [{ type: "text" as const, text: JSON.stringify(body) }] };
  },
};

/** 导出所有工具定义列表 */
export const tools: ToolDefinition[] = [echoTool, getDeviceConnectionLinkTool];
