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

  fastify.addHook('onRequest', async request => {
    request.moduleName = options.moduleName;
  });

  if (!fastify.hasDecorator(options.name)) {
    fastify.register(require('@kne/fastify-namespace'), {
      name: options.name,
      options,
      modules: [
        [
          'createIntl',
          async (locale, name) => {
            name = name || options.moduleName || 'global';
            const cacheKey = `${locale}:${name}`;

            const cached = intlCache.get(cacheKey);
            if (cached) {
              return cached;
            }

            if (!message[name] && typeof options.requestMessages === 'function') {
              try {
                const remoteMessages = await options.requestMessages({ locale, name });
                if (!message[locale]) {
                  message[locale] = {};
                }
                if (!message[locale][name]) {
                  message[locale][name] = {};
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
          }
        ],
        [
          'getRequestLocale',
          request => {
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
          }
        ]
      ],
      onMount: name => {
        if (name === options.name) {
          return;
        }
        const locale = fastify.namespace.modules?.[name]?.locale;
        locale && loadMessage(locale, name);
      }
    });
    fastify.addHook('preHandler', async request => {
      request.locale = fastify[options.name].getRequestLocale(request);
      request.intl = await fastify[options.name].createIntl(request.locale, request.moduleName);
      request.t = (id, values) => request.intl.formatMessage({ id }, values);
    });
  }
});
