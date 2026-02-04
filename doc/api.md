### 配置选项

| 属性名 | 说明 | 类型 | 默认值 |
|-----|----|----|-----|
| name | 插件装饰器名称 | string | 'intl' |
| acceptLanguage | 接受的语言列表，`*` 表示接受所有语言 | string | '*' |
| defaultLocale | 默认语言环境 | string | 'en-US' |
| moduleName | 默认模块名称 | string | 'global' |
| defaultMessages | 默认翻译消息对象 | object | {} |
| requestMessages | 动态加载翻译消息的函数，支持按 locale 和 name 缓存 | function\|null | null |
| cacheSize | Intl 缓存大小 | number | 100 |

#### requestMessages 说明

`requestMessages` 函数用于动态加载远程翻译消息。该函数会根据 `locale` 和 `name` 参数进行缓存，避免重复加载。

**函数签名：**
```typescript
requestMessages(params: {
  locale: string;
  name: string;
}): Promise<Record<string, string>> | Record<string, string>
```

**缓存机制：**
- 当首次调用 `createIntl(locale, name)` 时，如果 `message[locale][name]` 不存在，会触发 `requestMessages`
- 加载的消息会被缓存，后续相同 `locale` 和 `name` 的调用会直接使用缓存
- 缓存的 key 格式为 `${locale}:${name}`

**示例：**
```javascript
await fastify.register(fastifyIntl, {
  requestMessages: async ({ locale, name }) => {
    const response = await fetch(`https://api.example.com/messages/${locale}/${name}`);
    return response.json();
  }
});

// 第一次调用会触发远程请求
const intl1 = await fastify.intl.createIntl('en-US', 'user');

// 第二次调用使用缓存，不会触发远程请求
const intl2 = await fastify.intl.createIntl('en-US', 'user');

// 不同的 locale 或 name 会触发新的请求
const intl3 = await fastify.intl.createIntl('zh-CN', 'user');
```

### 请求属性

| 属性名 | 说明 | 类型 |
|-----|----|----|
| request.locale | 当前请求的语言环境 | string |
| request.intl | 国际化格式化对象 | IntlShape |
| request.moduleName | 当前模块名称 | string |
### 方法

创建一个国际化格式化实例。

| 参数 | 说明 | 类型 |
|-----|----|----|
| locale | 语言环境代码 | string |
| name | 模块名称，默认为配置的 moduleName | string |

返回值：`IntlShape` 对象

#### getRequestLocale(request)

从请求中获取语言环境。

| 参数 | 说明 | 类型 |
|-----|----|----|
| request | Fastify 请求对象 | Request |

返回值：语言环境字符串

检测顺序：query.language / query.lang → cookies.x-user-locale / cookies.x-client-language → headers.x-user-locale / headers.x-client-language → headers.accept-language → defaultLocale

#### request.t(id, values)

翻译消息的快捷方法。

| 参数 | 说明 | 类型 |
|-----|----|----|
| id | 消息 ID | string |
| values | 格式化参数 | object |

返回值：翻译后的字符串
