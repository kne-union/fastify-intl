const fp = require('fastify-plugin');
const merge = require('lodash/merge');
const { createIntl, createIntlCache } = require('@formatjs/intl');
const { LRUCache } = require('lru-cache');

const cache = createIntlCache();

module.exports = fp(async (fastify, options) => {
  options = Object.assign(
    {},
    {
      name: 'intl',
      acceptLanguage: '*',
      defaultLocale: 'en-US',
      moduleName: 'global',
      defaultMessages: {},
      requestMessages: null,
      cacheSize: 100,
      translateError: true
    },
    options
  );
  const message = {};
  const intlCache = new LRUCache({ max: options.cacheSize });
  const localeCache = new Map();

  const loadMessage = (localeMessage, name) => {
    if (!localeMessage) {
      return;
    }
    Object.keys(localeMessage).forEach(locale => {
      if (!message[locale]) {
        message[locale] = {};
      }
      message[locale][name || 'global'] = merge({}, message[locale][name || 'global'], localeMessage[locale]);
    });
  };

  if (options.defaultMessages) {
    loadMessage(options.defaultMessages, options.moduleName);
  }
  if (fastify.namespace && fastify.namespace.modules) {
    Object.keys(fastify.namespace.modules).forEach(name => {
      loadMessage(fastify.namespace.modules?.[name]?.locale, name);
    });
  }

  const createIntlInstance = async (locale, name) => {
    name = name || options.moduleName || 'global';
    const cacheKey = `${locale}:${name}`;

    const cached = intlCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (!message[locale]?.[name] && typeof options.requestMessages === 'function') {
      try {
        const remoteMessages = await options.requestMessages({ locale, name });
        if (!message[locale]) {
          message[locale] = {};
        }
        message[locale][name] = remoteMessages;
      } catch (e) {
        console.error(e);
      }
    }

    const currentMessages = message[locale]?.[name] || {};

    const intlInstance = createIntl(
      {
        locale,
        defaultLocale: options.defaultLocale,
        messages: Object.assign({}, currentMessages)
      },
      cache
    );

    intlCache.set(cacheKey, intlInstance);
    return intlInstance;
  };

  // messageValues 里可能带底层 Error（取其 message）或 Error 数组（逐项取 message 后以 ', ' 连接）
  const toPlain = value => (Array.isArray(value) ? value.map(toPlain).join(', ') : value instanceof Error ? value.message : value);
  const plainValues = values => values && Object.fromEntries(Object.entries(values).map(([key, value]) => [key, toPlain(value)]));

  const formatWith = (intl, messageId, values) => (intl && intl.messages[messageId] ? intl.formatMessage({ id: messageId }, plainValues(values)) : undefined);

  // createError 需同步拿到兜底文案，只用已加载的语言包，不触发 requestMessages
  const formatLoaded = (locale, name, messageId, values) => {
    const messages = message[locale]?.[name];
    if (!messages || !messages[messageId]) {
      return undefined;
    }
    return formatWith(createIntl({ locale, defaultLocale: options.defaultLocale, messages }, cache), messageId, values);
  };

  const createError = (name, messageId, values, { ErrorClass } = {}) => {
    name = name || options.moduleName || 'global';
    const text = formatLoaded(options.defaultLocale, name, messageId, values) ?? messageId;
    const error = ErrorClass ? new ErrorClass(text) : new Error(text);
    return Object.assign(error, { intlName: name, messageId, messageValues: values });
  };

  const translateError = async (request, error) => {
    if (!(error && error.intlName && error.messageId)) {
      return error;
    }
    for (const value of Object.values(error.messageValues || {})) {
      for (const item of [].concat(value)) {
        await translateError(request, item);
      }
    }
    const locales = [...new Set([getRequestLocale(request), options.defaultLocale])];
    for (const locale of locales) {
      const text = formatWith(await createIntlInstance(locale, error.intlName), error.messageId, error.messageValues);
      if (text !== undefined) {
        error.message = text;
        break;
      }
    }
    return error;
  };

  // Node fetch 默认带 `accept-language: *`，非法 locale 传给 createIntl 会抛 RangeError
  const toValidLocale = value => {
    const locale = typeof value === 'string' ? value.split(';')[0].trim() : '';
    if (!locale || locale === '*') {
      return null;
    }
    try {
      Intl.getCanonicalLocales(locale);
      return locale;
    } catch (e) {
      return null;
    }
  };

  const getRequestLocale = request => {
    const cacheKey = `${request.id}:locale`;
    if (localeCache.has(cacheKey)) {
      return localeCache.get(cacheKey);
    }

    const lang =
      [
        request.query?.lang,
        request.query?.language,
        request.cookies?.['x-user-locale'],
        request.cookies?.['x-client-language'],
        request.headers?.['x-user-locale'],
        request.headers?.['x-client-language'],
        request.headers?.['accept-language']?.split(',')[0]
      ]
        .map(toValidLocale)
        .find(Boolean) || options.defaultLocale;

    const result = options.acceptLanguage === '*' || options.acceptLanguage.split(',').includes(lang) ? lang : options.defaultLocale;

    localeCache.set(cacheKey, result);

    return result;
  };

  const withLocale = request => {
    return async moduleName => {
      const locale = fastify[options.name].getRequestLocale(request);
      const intl = await fastify[options.name].createIntl(locale, moduleName);
      return {
        locale,
        intl,
        t: (id, values) => intl.formatMessage({ id }, values)
      };
    };
  };

  if (!fastify.hasDecorator(options.name)) {
    fastify.register(require('@kne/fastify-namespace'), {
      name: options.name,
      options,
      modules: [
        ['createIntl', createIntlInstance],
        ['getRequestLocale', getRequestLocale],
        ['withLocale', withLocale],
        ['createError', createError],
        ['translateError', translateError],
        [
          't',
          (id, values) => {
            return fastify[options.name].defaultIntl.formatMessage({ id }, values);
          }
        ]
      ],
      onMount: async name => {
        if (name === options.name) {
          return;
        }
        const locale = fastify.namespace.modules?.[name]?.locale;
        locale && loadMessage(locale, name);
        if (name === options.moduleName) {
          fastify[options.name].defaultIntl = await createIntlInstance(options.defaultLocale, options.moduleName);
        }
      }
    });
    fastify.addHook('onRequest', async request => {
      request.withLocale = fastify[options.name].withLocale(request);
      const props = await request.withLocale(options.moduleName);
      Object.keys(props).forEach(name => {
        request[name] = props[name];
      });
    });
    if (options.translateError) {
      fastify.addHook('onError', async (request, reply, error) => {
        await translateError(request, error);
      });
    }
  }
});
