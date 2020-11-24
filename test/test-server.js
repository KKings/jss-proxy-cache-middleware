const express = require('express');
const path = require('path');
const { promises: fs } = require('fs');
const { createCacheMiddleware } = require('../src/index.js');
const { createFileCache } = require('../src/index.js');

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
    setTimeout(async () => {
        response.set('Content-Type', 'text/html; charset=utf-8');
        response.set('X-Test', 'Hello-World');
        response.set('X-Test-1', 'Another Test');

        let example = await fs.readFile(`${process.cwd()}/test/data/index.html`, 'utf8');
        example = example.replace('#{TIME}#', `${new Date()}`);

        response.end(example);
    }, 1000);
});

server.listen(port, () => console.log(`listening on ${port}`));
