const FileCache = require('../caching/file-cache.js');
const MemoryCache = require('../caching/memory-cache.js');
const ProxyCacheMiddleware = require('../proxy-cache-middleware.js');

export const createMemoryCache = (options) => new MemoryCache(options);
export const createFileCache = (options) => new FileCache(options);

export function createCacheMiddleware(options) {
    const cacheMiddlwareInstance = new ProxyCacheMiddleware(options);
    const { middleware } = cacheMiddlwareInstance;
    return middleware.bind(cacheMiddlwareInstance);
};
