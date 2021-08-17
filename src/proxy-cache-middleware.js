const URL = require('url');
const FileCache = require('./caching/file-cache');

const defaultOptions = {
    /**
     * Enable or disable the X-JSS-Proxy-Cache response header
     *
     * If enabled, will add a response headers for cache misses or cache hits:
     * - X-JSS-Proxy-Cache: HIT
     * - X-JSS-Proxy-Cache: MISS
     */
    setProxyCacheHeaders: true,

    /**
     * Enable or disable the usage of downstream (Sitecore) set headers
     *
     * If enabled, only headers added in the allowedDownstreamHeaders property
     * will be allowed to be resent when cached.
     */
    useDownstreamHeaders: true,

    /**
     * Response headers allowed to be sent with a cached response
     *
     * useDownstreamHeaders must be set to true
     */
    allowedDownstreamHeaders: [],

    /**
     * Default language of the website when a language cannot be determined.
     *
     * Language will be retrieve per request using the following rules:
     * - For Server-Side Rendering, language will be taken using the
     *      parseRouteUrl from the server bundle
     * - For Client-Side Rendering (Client-Side routing), language will be taken
     *      from the sc_lang parameter
     */
    defaultLanguage: 'en',

    /**
     * The proxyConfig passed to the Sitecore JSS scProxy function
     */
    proxyConfig: {
        layoutServiceRoute: '/sitecore/api/layout/render/jss',
        serverBundle: {
            parseRouteUrl: () => null,
        },
    },

    /**
     * When set, these paths will always bypass the caching logic and
     * the requests will be sent to the downstream (Sitecore) instance
     */
    bypassCacheByPath: [
        '/layouts/system',
        '/sitecore/api/jss/dictionary',
        '/dist/',
        '/-/media',
        '/-/jssmedia',
        '/assets/',
        '/api/',
    ],

    /**
     * When set, these user agents will always bypass the caching logic and
     * the requests will be sent to the downstream (Sitecore) instance
     */
    bypassCacheByUserAgents: [],
};

class ProxyCacheMiddleware {
    constructor(options) {
        this.options = { ...defaultOptions, ...options };

        if (!this.options.cache) {
            this.options.cache = new FileCache({});
        }

        ProxyCacheMiddleware.rewriteCreateViewBag(this.options.proxyConfig);
    }

    async middleware(request, response, next) {
        if (this.shouldBypassCache(request)) {
            return next();
        }

        const routeParams = ProxyCacheMiddleware.getRouteParams(request.originalUrl,
            this.options.proxyConfig,
            this.options.defaultLanguage);

        try {
            const cacheData = await this.options.cache.get(routeParams) ?? {};

            if (!ProxyCacheMiddleware.isCacheValid(cacheData)) {
                this.interceptProxyResponse(request, response, routeParams);
                return next();
            }

            if (this.options.setProxyCacheHeaders) {
                response.set('x-proxy-cache', 'HIT');
            }

            if (this.options.useDownstreamHeaders) {
                ProxyCacheMiddleware.applyCachedHeaders(response, cacheData.headers);
            }

            if (cacheData.contentType) {
                response.set('Content-Type', cacheData.contentType);
            }

            return response.send(cacheData.data);
        } catch (error) {
            return next(error);
        }
    }

    interceptProxyResponse(request, response, routeParams) {
        const {
            end: originalEnd,
            write: originalWrite,
        } = response;

        if (this.options.setProxyCacheHeaders) {
            response.set('x-proxy-cache', 'MISS');
        }

        // eslint-disable-next-line new-cap
        let buffer = new Buffer.alloc(0);

        response.write = (data) => {
            buffer = Buffer.concat([buffer, data]);
        };

        response.end = async (data) => {
            const body = data || buffer.toString();

            /** 
             * isRouteCacheable is added here:
             * - for SSR, see the createViewBag
             * - for Layout Service requests, see below
             */
            if (routeParams.isApiRequest) {
                const asJson = ProxyCacheMiddleware.parseLayoutService(body);
                /** 
                 * Run same method as SSR
                 */
                 ProxyCacheMiddleware.createViewBag(null, response, null, asJson);
            }

            if (response.statusCode === 200 && response.isRouteCacheable) {
                const headers = this.options.useDownstreamHeaders
                    ? ProxyCacheMiddleware.getAllowedDownstreamHeaders(response,
                        this.options.allowedDownstreamHeaders)
                    : {};
                const contentType = response.get('Content-Type');
                await this.options.cache.write(routeParams, contentType, headers, body);
            }

            originalWrite.call(response, body);
            originalEnd.call(response);
        };
    }

    shouldBypassCache(request) {
        return request.method !== 'GET'
            || this.isExcludedPath(request.originalUrl)
            || this.isExcludedUserAgent(request.get('user-agent'));
    }

    isExcludedUserAgent(requestUserAgent) {
        if (!requestUserAgent) {
            return false;
        }

        const containsExcludedUserAgent = !!this.options.bypassCacheByUserAgents.find(
            (userAgent) => requestUserAgent.toLowerCase() === userAgent.toLowerCase(),
        );

        return containsExcludedUserAgent;
    }

    /**
     * @param {string} method request method
     * @param {string} url request url
     * @returns {boolean} is path excluded
     */
    isExcludedPath(url) {
        const containsExcludedPath = !!this.options.bypassCacheByPath.find((path) => url.startsWith(path));

        return containsExcludedPath;
    }

    static isLayoutRequestCacheable(layoutServiceData) {
        if  (!layoutServiceData
            || !layoutServiceData.sitecore
            || !layoutServiceData.sitecore.context) {
            return undefined;
        }

        return layoutServiceData.sitecore.context.cacheable !== undefined
            ? layoutServiceData.sitecore.context.cacheable
            : true;
    }

    static parseLayoutService(data) {
        if (!data) {
            return {};
        }

        return ProxyCacheMiddleware.tryParseJson(data);
    }

    static tryParseJson(data) {
        try {
            var json = JSON.parse(data);

            if (json && typeof json === 'object' && json !== null) {
                return json;
            }
        }
        catch (e) {
            console.error("error parsing json string '" + data + "'", e);
        }

        return {};
    }

    static createViewBag(request, response, proxyResponse, layoutServiceData) {
        if (!layoutServiceData
            || !layoutServiceData.sitecore
            || !layoutServiceData.sitecore.context) {
            return;
        }

        response.isRouteCacheable = ProxyCacheMiddleware.isLayoutRequestCacheable(layoutServiceData);
    }

    static rewriteCreateViewBag(proxyOptions) {
        const originalCreateViewBag = proxyOptions.createViewBag;

        if (proxyOptions.createViewBag) {
            // eslint-disable-next-line no-param-reassign
            proxyOptions.createViewBag = (request, response, proxyResponse, layoutServiceData) => {
                this.createViewBag(request, response, proxyResponse, layoutServiceData);
                originalCreateViewBag.call(request, response, proxyResponse, layoutServiceData);
            };
        }

        return proxyOptions;
    }

    static applyCachedHeaders(response, cachedHeaders = []) {
        if (!response) {
            return;
        }

        if (!response.get('Content-Type')) {
            response.set('Content-Type', 'text/html; charset=utf-8');
        }

        if (cachedHeaders) {
            const headerNames = Object.keys(cachedHeaders);
            headerNames.forEach((headerName) => response.set(headerName, cachedHeaders[headerName]));
        }
    }

    static getAllowedDownstreamHeaders(response, allowedHeaders = []) {
        if (!response || !allowedHeaders || allowedHeaders.length === 0) {
            return [];
        }

        const headers = {
            ...response.getHeaders(),
        };

        Object.keys(headers).forEach((value) => {
            if (!allowedHeaders.includes(value.toLowerCase())) {
                delete headers[value];
            }
        });

        return headers;
    }

    static isCacheValid(cacheItem) {
        return cacheItem && cacheItem.data;
    }

    static getRouteParams(requestUrl, proxyConfig, defaultLanguage) {
        const proxyParseRouteUrl = proxyConfig.serverBundle.parseRouteUrl;
        const layoutServiceUrl = proxyConfig.layoutServiceRoute;

        if (requestUrl.indexOf(layoutServiceUrl) !== -1) {
            const route = URL.parse(requestUrl, true);

            return {
                sitecoreRoute: route.query.item,
                language: route.query.sc_lang ?? defaultLanguage,
                isApiRequest: true,
            };
        }

        const routeParams = {
            language: defaultLanguage,
            isApiRequest: false,
            ...proxyParseRouteUrl(requestUrl),
        };

        /**
         * Normalize the route path as proxy parseRouteUrl function
         * strips out any leading slash
         */

        if (!routeParams.sitecoreRoute) {
            routeParams.sitecoreRoute = URL.parse(requestUrl, true).path;
        }

        return routeParams;
    }
}

module.exports = ProxyCacheMiddleware;
