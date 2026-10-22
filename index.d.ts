import { FastifyPlugin, FastifyRequest } from 'fastify';
import { IntlShape } from '@formatjs/intl';

declare module 'fastify' {
  interface FastifyInstance {
    [decoratorName: string]: {
      createIntl(locale: string, name?: string): Promise<IntlShape<string>>;
      getRequestLocale(request: FastifyRequest): string;
      createError(
        name: string | null,
        messageId: string,
        values?: Record<string, unknown>,
        options?: { ErrorClass?: new (message: string) => Error }
      ): Error & { intlName: string; messageId: string; messageValues?: Record<string, unknown> };
      translateError<T>(request: FastifyRequest, error: T): Promise<T>;
    };
  }

  interface FastifyRequest {
    locale: string;
    intl: IntlShape<string>;
    moduleName: string;
    t(id: string, values?: Record<string, unknown>): string;
  }

  namespace FastifyNamespace {
    interface LocaleMessage {
      [locale: string]: Record<string, string>;
    }

    interface NamespaceModule {
      locale?: LocaleMessage;
      [key: string]: unknown;
    }
  }
}

export interface FastifyIntlOptions {
  /** 插件装饰器名称 */
  name?: string;
  /** 接受的语言列表，'*' 表示接受所有语言 */
  acceptLanguage?: string;
  /** 默认语言环境 */
  defaultLocale?: string;
  /** 默认模块名称 */
  moduleName?: string;
  /** 默认翻译消息对象 */
  defaultMessages?: {
    [locale: string]: Record<string, string>;
  };
  /** 动态加载翻译消息的函数 */
  requestMessages?: (params: {
    locale: string;
    name: string;
  }) => Promise<Record<string, string>> | Record<string, string>;
  /** 缓存大小 */
  cacheSize?: number;
  /** 是否注册 onError 钩子翻译 createError 创建的错误，默认 true */
  translateError?: boolean;
}

declare const fastifyIntl: FastifyPlugin<FastifyIntlOptions>;

export default fastifyIntl;
