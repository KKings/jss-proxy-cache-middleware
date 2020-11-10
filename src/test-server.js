const express = require('express');
const path = require('path');
const { createCacheMiddleware } = require('./index.js');
const { createFileCache } = require('./index.js');

const server = express();
const port = process.env.PORT || 3000;

server.settings['x-powered-by'] = false;

const cachingOptions = {
    cache: createFileCache({
        duration: 30,
    }),
    useDownstreamHeaders: false,
};

server.use(express.static(path.join(process.cwd(), 'public')));
server.get('/favicon.ico', (request, response) => response.status(204).end(null));

server.use(createCacheMiddleware(cachingOptions));
server.get('*', (request, response) => {
    setTimeout(() => {
        response.set('X-Test', 'Hello-World');
        response.set('X-Test-1', 'Hello Man');
        response.set('Content-Type', 'text/html; charset=utf-8');
        response.end(`hello world, ${new Date()}`);
    }, 1000);
});

server.listen(port, () => console.log(`listening on ${port}`));
