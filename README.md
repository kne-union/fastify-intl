
# fastify-intl


### 描述

`@kne/fastify-intl` 是一个专为 Fastify 项目设计的国际化解决方案插件。它基于业界成熟的 `@formatjs/intl` 库构建，提供了强大而灵活的多语言支持能力，帮助开发者轻松实现应用的国际化和本地化。


### 安装

```shell
npm i --save @kne/fastify-intl
```


### 概述

`@kne/fastify-intl` 是一个专为 Fastify 项目设计的国际化解决方案插件。它基于业界成熟的 `@formatjs/intl` 库构建，提供了强大而灵活的多语言支持能力，帮助开发者轻松实现应用的国际化和本地化。

该插件采用现代化的设计理念，支持按需加载语言包，完美集成 Fastify 生态系统。通过命名空间管理机制，不同模块可以独立维护自己的翻译文件，避免代码耦合。插件内置多种语言检测策略，包括查询参数、Cookie 和请求头，确保为用户提供最合适的语言体验。

`@kne/fastify-intl` 提供了简洁直观的 API，在请求对象上直接暴露 `locale`、`intl` 和 `t` 等属性，让国际化操作变得轻而易举。它还支持动态加载远程语言包，配合智能缓存机制，既保证了性能又提供了足够的扩展性。无论是小型项目还是大型企业级应用，这款插件都能满足各种国际化场景的需求。

### 基础使用

#### 1. 注册插件

```javascript
const fastify = require('fastify')();
const fastifyIntl = require('@kne/fastify-intl');

await fastify.register(fastifyIntl);
```

#### 2. 配置默认翻译消息

```javascript
await fastify.register(fastifyIntl, {
  defaultMessages: {
    'en-US': {
      hello: 'Hello World',
      welcome: 'Welcome, {name}!'
    },
    'zh-CN': {
      hello: '你好世界',
      welcome: '欢迎, {name}!'
    }
  }
});
```

#### 3. 在路由中使用

```javascript
fastify.get('/hello', async (request, reply) => {
  return {
    message: request.t('hello')
  };
});

fastify.get('/welcome', async (request, reply) => {
  return {
    message: request.t('welcome', { name: 'John' })
  };
});
```

### 动态加载翻译消息

```javascript
await fastify.register(fastifyIntl, {
  requestMessages: async ({ locale, name }) => {
    const response = await fetch(`https://api.example.com/messages/${locale}/${name}`);
    return response.json();
  }
});
```

### 与命名空间集成

```javascript
await fastify.register(require('@kne/fastify-namespace'));
await fastify.register(fastifyIntl);

fastify.namespace.user = {
  locale: {
    'en-US': {
      profile: {
        title: 'User Profile',
        settings: 'Settings'
      }
    }
  }
};

fastify.namespace.order = {
  locale: {
    'en-US': {
      title: 'My Orders'
    }
  }
};
```

### 自定义语言检测顺序

```javascript
await fastify.register(fastifyIntl, {
  defaultLocale: 'en-US',
  acceptLanguage: 'en-US,zh-CN,ja-JP'
});
```

语言检测优先级：
1. query.language / query.lang
2. cookies.x-user-locale / cookies.x-client-language
3. headers.x-user-locale / headers.x-client-language
4. headers.accept-language
5. defaultLocale

### 控制缓存大小

插件使用 LRU 缓存来优化性能，支持两个级别的缓存：

```javascript
await fastify.register(fastifyIntl, {
  cacheSize: 200
});
```

- `intlCache`: 缓存 `Intl` 实例，避免重复创建（LRU 策略，默认最多 100 个）
- `localeCache`: 缓存请求级别的 locale 检测结果（Map 结构，无限制）

## 多模块支持

```javascript
await fastify.register(fastifyIntl, {
  moduleName: 'app'
});

// 在请求中切换模块
fastify.get('/admin', async (request, reply) => {
  request.moduleName = 'admin';
  request.intl = await fastify.intl.createIntl(request.locale, 'admin');
  return {
    message: request.t('dashboard')
  };
});
```

### Q: 如何处理缺失的翻译？

插件会自动回退到 `defaultLocale`，确保始终有可用的翻译。

### Q: 如何支持嵌套的翻译消息？

消息对象支持嵌套结构：

```javascript
{
  'en-US': {
    user: {
      profile: {
        title: 'User Profile',
        name: 'Full Name'
      }
    }
  }
}
```

使用点号访问嵌套消息：

```javascript
request.t('user.profile.title')
```

### Q: 如何处理复数形式？

使用 ICU MessageFormat 语法：

```javascript
{
  'en-US': {
    itemCount: 'You have {count, plural, =0{no items} one{1 item} other{# items}}'
  }
}

request.t('itemCount', { count: 5 }) // "You have 5 items"
```

### Q: 如何在生产环境禁用动态加载？

```javascript
await fastify.register(fastifyIntl, {
  requestMessages: process.env.NODE_ENV === 'development' ? loadRemoteMessages : null
});
```



### 示例

#### 示例代码



### API

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

