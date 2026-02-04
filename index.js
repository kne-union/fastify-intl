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
      cacheSize: 100
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

  const getRequestLocale = request => {
    const cacheKey = `${request.id}:locale`;
    if (localeCache.has(cacheKey)) {
      return localeCache.get(cacheKey);
    }

    const lang =
      request.query?.lang ||
      request.query?.language ||
      request.cookies?.['x-user-locale'] ||
      request.cookies?.['x-client-language'] ||
      request.headers?.['x-user-locale'] ||
      request.headers?.['x-client-language'] ||
      request.headers?.['accept-language']?.split(',')[0] ||
      options.defaultLocale;

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
  }
});
