const mCache = require('memory-cache');
const { v5: uuid } = require('uuid');

const defaultOptions = {
    duration: 1 * 30,
};

class MemoryCache {
    constructor(options) {
        this.options = { ...defaultOptions, ...options };
    }

    static async get(routeParams) {
        const cacheKey = MemoryCache.getCacheKey(routeParams);
        const cachedData = mCache.get(cacheKey);

        if (!cachedData) {
            return {};
        }

        try {
            return JSON.parse(cachedData);
        } catch (error) {
            console.log(`An error occured getting cached item for cache key: ${cacheKey}. Error: ${error}`);
            return {};
        }
    }

    async write(routeParams, contentType, headers, data) {
        if (!data || data.length === 0) {
            return;
        }

        const cacheItem = JSON.stringify({
            routeParams: {
                ...routeParams,
            },
            headers: {
                ...headers,
            },
            data,
            contentType,
            expires: new Date(new Date().getTime() + this.options.duration * 1000),
        });

        const cacheKey = this.getCacheKey(routeParams);

        mCache.put(cacheKey, cacheItem, this.options.duration * 1000);
    }

    static getCacheKey(routeParams) {
        if (!routeParams) {
            throw new Error('routeParams cannot be null or empty.');
        }

        const api = routeParams.isApiRequest ? 'api' : '';

        const namespace = '5ffd6089-2e7f-4cc8-9382-481051ff291e';
        const cacheKey = `${api}_${routeParams.language}_${routeParams.sitecoreRoute}`.toLowerCase();
        const hashKey = uuid(cacheKey, namespace);

        return hashKey;
    }
}

module.exports = MemoryCache;
