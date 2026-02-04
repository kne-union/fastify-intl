import { FastifyPlugin, FastifyRequest } from 'fastify';
import { IntlShape } from '@formatjs/intl';

declare module 'fastify' {
  interface FastifyInstance {
    [decoratorName: string]: {
      createIntl(locale: string, name?: string): Promise<IntlShape<string>>;
      getRequestLocale(request: FastifyRequest): string;
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
}

declare const fastifyIntl: FastifyPlugin<FastifyIntlOptions>;

export default fastifyIntl;
