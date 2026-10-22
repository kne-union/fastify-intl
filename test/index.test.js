const { expect } = require('chai');
const fastifyIntl = require('../index');

describe('@kne/fastify-intl', function () {
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

  describe('invalid locale fallback', () => {
    it('should ignore wildcard and invalid locales', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        defaultLocale: 'zh-CN'
      });
      await fastify.ready();

      expect(fastify.intl.getRequestLocale({ id: 'r1', query: {}, cookies: {}, headers: { 'accept-language': '*' } })).to.equal('zh-CN');
      expect(fastify.intl.getRequestLocale({ id: 'r2', query: { lang: 'zh_CN' }, cookies: {}, headers: {} })).to.equal('zh-CN');
      expect(fastify.intl.getRequestLocale({ id: 'r3', query: { lang: 'not a locale' }, cookies: {}, headers: { 'accept-language': 'en-US' } })).to.equal('en-US');
      expect(fastify.intl.getRequestLocale({ id: 'r4', query: {}, cookies: {}, headers: { 'accept-language': 'en-GB;q=0.9,en;q=0.8' } })).to.equal('en-GB');

      await fastify.close();
    });

    it('should not fail requests with accept-language wildcard', async () => {
      const fastify = require('fastify')();

      await fastify.register(fastifyIntl, {
        defaultLocale: 'en-US'
      });
      fastify.get('/', async request => ({ locale: request.locale || null }));
      await fastify.ready();

      const res = await fastify.inject({ method: 'GET', url: '/', headers: { 'accept-language': '*' } });
      expect(res.statusCode).to.equal(200);

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
        defaultLocale: 'en-US',
        moduleName: 'test',
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

  describe('createError and translateError', () => {
    const createApp = async (intlOptions = {}) => {
      const fastify = require('fastify')();
      await fastify.register(fastifyIntl, Object.assign({ defaultLocale: 'zh-CN' }, intlOptions));
      await fastify.register(require('@kne/fastify-namespace'), {
        name: 'biz',
        modules: [
          [
            'locale',
            {
              'zh-CN': { notFound: '项目{id}不存在', zhOnly: '仅中文' },
              'en-US': { notFound: 'Project {id} not found' }
            }
          ]
        ]
      });
      fastify.get('/not-found', async () => {
        throw fastify.intl.createError('biz', 'notFound', { id: 7 });
      });
      fastify.get('/forbidden', async () => {
        class Forbidden extends Error {
          constructor(message) {
            super(message);
            this.statusCode = 403;
          }
        }
        throw fastify.intl.createError('biz', 'notFound', { id: 8 }, { ErrorClass: Forbidden });
      });
      fastify.get('/zh-only', async () => {
        throw fastify.intl.createError('biz', 'zhOnly');
      });
      fastify.get('/missing', async () => {
        throw fastify.intl.createError('biz', 'missingKey');
      });
      fastify.get('/plain', async () => {
        throw new Error('原始错误');
      });
      await fastify.ready();
      return fastify;
    };

    it('should prefill message with default locale', async () => {
      const fastify = await createApp();
      const error = fastify.intl.createError('biz', 'notFound', { id: 1 });
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.equal('项目1不存在');
      expect(error.messageId).to.equal('notFound');
      expect(error.intlName).to.equal('biz');
      await fastify.close();
    });

    it('should translate error by request locale', async () => {
      const fastify = await createApp();
      const en = await fastify.inject({ url: '/not-found', headers: { 'x-user-locale': 'en-US' } });
      expect(JSON.parse(en.body).message).to.equal('Project 7 not found');
      const zh = await fastify.inject({ url: '/not-found' });
      expect(JSON.parse(zh.body).message).to.equal('项目7不存在');
      await fastify.close();
    });

    it('should keep status code of ErrorClass', async () => {
      const fastify = await createApp();
      const res = await fastify.inject({ url: '/forbidden', headers: { 'x-user-locale': 'en-US' } });
      expect(res.statusCode).to.equal(403);
      expect(JSON.parse(res.body).message).to.equal('Project 8 not found');
      await fastify.close();
    });

    it('should fallback to default locale when key missing in request locale', async () => {
      const fastify = await createApp();
      const res = await fastify.inject({ url: '/zh-only', headers: { 'x-user-locale': 'en-US' } });
      expect(JSON.parse(res.body).message).to.equal('仅中文');
      await fastify.close();
    });

    it('should fallback to messageId when key missing everywhere', async () => {
      const fastify = await createApp();
      const res = await fastify.inject({ url: '/missing', headers: { 'x-user-locale': 'en-US' } });
      expect(JSON.parse(res.body).message).to.equal('missingKey');
      await fastify.close();
    });

    it('should not touch untagged errors', async () => {
      const fastify = await createApp();
      const res = await fastify.inject({ url: '/plain', headers: { 'x-user-locale': 'en-US' } });
      expect(JSON.parse(res.body).message).to.equal('原始错误');
      await fastify.close();
    });

    it('should skip translation when translateError is false', async () => {
      const fastify = await createApp({ translateError: false });
      const res = await fastify.inject({ url: '/not-found', headers: { 'x-user-locale': 'en-US' } });
      expect(JSON.parse(res.body).message).to.equal('项目7不存在');
      await fastify.close();
    });
  });
});
