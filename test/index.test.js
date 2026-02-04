const { expect } = require('chai');
const fastifyIntl = require('../index');

describe('@kne/fastify-intl', function() {
  describe('plugin registration with default options', () => {
    it('should add intl decorator', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl);
      await fastify.ready();

      expect(fastify.intl).to.exist;
      expect(typeof fastify.intl.createIntl).to.equal('function');
      expect(typeof fastify.intl.getRequestLocale).to.equal('function');

      await fastify.close();
    });
  });

  describe('plugin registration with custom options', () => {
    it('should use custom decorator name', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        name: 'i18n',
        defaultLocale: 'zh-CN',
        moduleName: 'app',
        cacheSize: 50
      });
      await fastify.ready();

      expect(fastify.i18n).to.exist;
      expect(typeof fastify.i18n.createIntl).to.equal('function');

      await fastify.close();
    });
  });

  describe('defaultMessages option', () => {
    it('should load default messages', async () => {
      const fastify = require('fastify')();

      const defaultMessages = {
        'en-US': {
          hello: 'Hello World'
        },
        'zh-CN': {
          hello: '你好世界'
        }
      };

      await fastify.register(fastifyIntl, {
        defaultMessages,
        moduleName: 'global'
      });
      await fastify.ready();

      const intl = await fastify.intl.createIntl('en-US', 'global');
      expect(intl.formatMessage({ id: 'hello' })).to.equal('Hello World');

      const zhIntl = await fastify.intl.createIntl('zh-CN', 'global');
      expect(zhIntl.formatMessage({ id: 'hello' })).to.equal('你好世界');

      await fastify.close();
    });
  });

  describe('getRequestLocale priority order', () => {
    it('should fallback to default locale', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        defaultLocale: 'en-US'
      });
      await fastify.ready();

      const request = {
        id: 'test-request-id',
        query: {},
        cookies: {},
        headers: {}
      };

      const locale = fastify.intl.getRequestLocale(request);
      expect(locale).to.equal('en-US');

      await fastify.close();
    });

    it('should get locale from query.language parameter', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        defaultLocale: 'en-US'
      });
      await fastify.ready();

      const request = {
        id: 'test-request-id',
        query: { language: 'zh-CN' },
        cookies: {},
        headers: {}
      };

      const locale = fastify.intl.getRequestLocale(request);
      expect(locale).to.equal('zh-CN');

      await fastify.close();
    });

    it('should get locale from query.lang parameter', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        defaultLocale: 'en-US'
      });
      await fastify.ready();

      const request = {
        id: 'test-request-id',
        query: { lang: 'ja-JP' },
        cookies: {},
        headers: {}
      };

      const locale = fastify.intl.getRequestLocale(request);
      expect(locale).to.equal('ja-JP');

      await fastify.close();
    });

    it('should get locale from cookie x-user-locale', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        defaultLocale: 'en-US'
      });
      await fastify.ready();

      const request = {
        id: 'test-request-id',
        query: {},
        cookies: { 'x-user-locale': 'fr-FR' },
        headers: {}
      };

      const locale = fastify.intl.getRequestLocale(request);
      expect(locale).to.equal('fr-FR');

      await fastify.close();
    });

    it('should get locale from header x-user-locale', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        defaultLocale: 'en-US'
      });
      await fastify.ready();

      const request = {
        id: 'test-request-id',
        query: {},
        cookies: {},
        headers: { 'x-user-locale': 'de-DE' }
      };

      const locale = fastify.intl.getRequestLocale(request);
      expect(locale).to.equal('de-DE');

      await fastify.close();
    });
  });

  describe('acceptLanguage filter', () => {
    it('should accept language in whitelist', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        acceptLanguage: 'en-US,zh-CN',
        defaultLocale: 'en-US'
      });
      await fastify.ready();

      const request = {
        id: 'test-request-id',
        query: {},
        cookies: {},
        headers: { 'accept-language': 'zh-CN' }
      };

      const locale = fastify.intl.getRequestLocale(request);
      expect(locale).to.equal('zh-CN');

      await fastify.close();
    });

    it('should reject language not in whitelist', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        acceptLanguage: 'en-US,zh-CN',
        defaultLocale: 'en-US'
      });
      await fastify.ready();

      const request = {
        id: 'test-request-id',
        query: {},
        cookies: {},
        headers: { 'accept-language': 'fr-FR' }
      };

      const locale = fastify.intl.getRequestLocale(request);
      expect(locale).to.equal('en-US');

      await fastify.close();
    });
  });

  describe('requestMessages dynamic loading', () => {
    it('should load messages remotely and cache', async () => {
      const fastify = require('fastify')();

      let callCount = 0;
      const requestMessages = async ({ locale }) => {
        callCount++;
        return { dynamic: 'Dynamic message' };
      };

      await fastify.register(fastifyIntl, {
        requestMessages
      });
      await fastify.ready();

      // First call should trigger remote loading
      const intl1 = await fastify.intl.createIntl('en-US', 'test');
      expect(intl1.formatMessage({ id: 'dynamic' })).to.equal('Dynamic message');
      expect(callCount).to.equal(1);

      // Second call should use cache
      const intl2 = await fastify.intl.createIntl('en-US', 'test');
      expect(intl2.formatMessage({ id: 'dynamic' })).to.equal('Dynamic message');
      expect(callCount).to.equal(1);

      await fastify.close();
    });
  });

  describe('Intl caching', () => {
    it('should cache intl instances', async () => {
      const fastify = require('fastify')();

      const defaultMessages = {
        'en-US': {
          test: 'Test message'
        }
      };

      await fastify.register(fastifyIntl, {
        defaultMessages,
        cacheSize: 10,
        moduleName: 'global'
      });
      await fastify.ready();

      const intl1 = await fastify.intl.createIntl('en-US', 'global');
      const intl2 = await fastify.intl.createIntl('en-US', 'global');

      expect(intl1).to.equal(intl2);

      await fastify.close();
    });

    it('should return different instances for different cache keys', async () => {
      const fastify = require('fastify')();

      const defaultMessages = {
        'en-US': {
          test: 'Test message'
        }
      };

      await fastify.register(fastifyIntl, {
        defaultMessages,
        cacheSize: 10,
        moduleName: 'global'
      });
      await fastify.ready();

      const intl1 = await fastify.intl.createIntl('en-US', 'global');
      const intl2 = await fastify.intl.createIntl('zh-CN', 'global');
      const intl3 = await fastify.intl.createIntl('en-US', 'other');

      expect(intl1).to.not.equal(intl2);
      expect(intl1).to.not.equal(intl3);
      expect(intl2).to.not.equal(intl3);

      await fastify.close();
    });
  });

  describe('locale cache', () => {
    it('should cache locale detection results', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        defaultLocale: 'en-US'
      });
      await fastify.ready();

      const request = {
        id: 'test-request-id',
        query: { language: 'zh-CN' },
        cookies: {},
        headers: {}
      };

      // Call getRequestLocale multiple times
      const locale1 = fastify.intl.getRequestLocale(request);
      const locale2 = fastify.intl.getRequestLocale(request);

      expect(locale1).to.equal('zh-CN');
      expect(locale2).to.equal('zh-CN');

      await fastify.close();
    });
  });
});
