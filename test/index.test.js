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

      fastify.get('/test', async (request, reply) => {
        reply.send({ locale: request.locale });
      });

      await fastify.ready();

      const res = await fastify.inject({
        method: 'GET',
        url: '/test'
      });
      expect(JSON.parse(res.payload)).to.deep.equal({ locale: 'en-US' });

      await fastify.close();
    });

    it('should get locale from query parameter', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        defaultLocale: 'en-US'
      });

      fastify.get('/test', async (request, reply) => {
        reply.send({ locale: request.locale });
      });

      await fastify.ready();

      const res = await fastify.inject({
        method: 'GET',
        url: '/test?language=zh-CN'
      });
      expect(JSON.parse(res.payload)).to.deep.equal({ locale: 'zh-CN' });

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

      fastify.get('/test', async (request, reply) => {
        reply.send({ locale: request.locale });
      });

      await fastify.ready();

      const res = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'accept-language': 'zh-CN'
        }
      });
      expect(JSON.parse(res.payload)).to.deep.equal({ locale: 'zh-CN' });

      await fastify.close();
    });

    it('should reject language not in whitelist', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        acceptLanguage: 'en-US,zh-CN',
        defaultLocale: 'en-US'
      });

      fastify.get('/test', async (request, reply) => {
        reply.send({ locale: request.locale });
      });

      await fastify.ready();

      const res = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'accept-language': 'fr-FR'
        }
      });
      expect(JSON.parse(res.payload)).to.deep.equal({ locale: 'en-US' });

      await fastify.close();
    });
  });

  describe('request.t shortcut method', () => {
    it('should translate messages', async () => {
      const fastify = require('fastify')();

      const defaultMessages = {
        'en-US': {
          greeting: 'Hello {name}!'
        }
      };

      await fastify.register(fastifyIntl, {
        defaultMessages,
        moduleName: 'global'
      });

      fastify.get('/test', async (request, reply) => {
        reply.send({ message: request.t('greeting', { name: 'John' }) });
      });

      await fastify.ready();

      const res = await fastify.inject({
        method: 'GET',
        url: '/test'
      });
      expect(JSON.parse(res.payload)).to.deep.equal({ message: 'Hello John!' });

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
  });
});
