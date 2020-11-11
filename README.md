
# jss-proxy-cache-middleware

An express caching middleware to use with Headless Sitecore JSS to provide controllable output caching.

## TL;DR

TL;Dr The goal is to provide a caching middleware that can provide "smart" output caching to the Sitecore JSS Proxy. 

Current caching approaches for Sitecore JSS websites:

* _all or nothing_ - does not allow for pages that use Sitecore Personalization, A/B Testing or are highly dynamic and cannot be cached
* _cost money_ - pay company to provide the ability to cache at the CDN
** The cost can be less of a factor once you scale your Sitecore infrastructure down

Why do you need to output cache at the Headless Proxy? Performance and scalability (and potentially a huge cost savings). Additionally, for companies with tighter security concerns, the infrastructure and code is still governed by the organization.

Straightforward example to apply output caching to your headless Sitecore JSS proxy. 
```javascript
const express = require('express');
const scProxy = require('@sitecore-jss/sitecore-jss-proxy').default;
const config = require('./config');
const { createCacheMiddleware } = require('jss-proxy-cache-middleware');

const server = express();
const port = process.env.PORT || 3000;

// Add in the caching middleware with default options
const cachingOptions = {
  defaultLanguage: 'en',
  proxyConfig: config,
};

server.use(createCacheMiddleware(cachingOptions));

server.use('*', scProxy(config.serverBundle.renderView, config, config.serverBundle.parseRouteUrl));

server.listen(port, () => {
  console.log(`server listening on port ${port}!`);
});
```
Note: By default, the cachingMiddleware will use a file-system based cache with a 30 second lifetime.

## Roadmap

This project is currently a work-in-progress.

### Current Features

- HTML output caching for Server-Side Rendering at the proxy 
- Layout Service API output caching for Client-Side Rendering at the proxy

### Roadmap Features

- Ability to Bypass Cache for personalized pages
- Ability to Bypass Cache for A/B tested pages
- Ability to Bypass Cache by Authorable Settings
- Ability to clear cache
- Ability to track hit/miss telemetry
- Ability to apply cache rules by route

## Cache Managers

Todo: Add cache managers

The following cache managers are provided:

- File-System Cache
- Memory Cache

## Options

Todo: Add all available options

The following options are provided to configure the middleware:
- **defaultLanguage**: Default language of the website when a language cannot be determined
- **proxyConfig**: The proxyConfig passed to the Sitecore JSS scProxy function
- **setProxyCacheHeaders**: Enable or disable a X-JSS-Proxy-Cache response header
- **useDownstreamHeaders**: Enable or disable the usage of downstream headers set on a cached response
- **allowedDownstreamHeaders**: Response headers allowed to be sent with a cached response
- **bypassCacheByPath** - When set, these paths will always bypass the caching logic
- **bypassCacheByUserAgents**: When set, these user agents will always bypass the caching logic