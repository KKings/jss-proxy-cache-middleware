const ProxyCacheMiddleware = require('./proxy-cache-middleware.js');
const FileCache = require('./caching/file-cache');
const MemoryCache = require('./caching/memory-cache');

const createCacheMiddleware = (options) => {
    const cacheMiddlwareInstance = new ProxyCacheMiddleware(options);
    const { middleware } = cacheMiddlwareInstance;
    return middleware.bind(cacheMiddlwareInstance);
};

const createFileCache = (options) => new FileCache(options);
const createMemoryCache = (options) => new MemoryCache(options);

module.exports = {
    createCacheMiddleware,
    createFileCache,
    createMemoryCache,
};
