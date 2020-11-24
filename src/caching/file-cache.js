const { promises: fs } = require('fs');
const path = require('path');
const { v5: uuid } = require('uuid');

const defaultOptions = {
    duration: 1 * 30,
    directory: '.cache',
    emptyOnStartup: true,
};

class FileCache {
    constructor(options) {
        this.options = { ...defaultOptions, ...options };

        const directory = path.join(process.cwd(), this.options.directory);

        if (!(fs.stat(directory).catch(() => false))) {
            fs.mkdir(directory, { recursive: true });
        } else if (this.options.emptyOnStartup) {
            fs.rmdir(directory, { recursive: true })
                .then(() => fs.mkdir(directory, { recursive: true }));
        }
    }

    async get(routeParams) {
        const filePath = this.getFilePath(routeParams);

        if (!filePath || !(await fs.stat(filePath).catch(() => false))) {
            return {};
        }

        try {
            const cachedFile = await fs.readFile(filePath, 'utf8');
            const cachedItem = JSON.parse(cachedFile);

            return FileCache.isCacheValid(cachedItem.expires) ? cachedItem : {};
        } catch (error) {
            console.log(`An error occured getting cached item for filePath: ${filePath}. Error: ${error}`);
            return {};
        }
    }

    async write(routeParams, contentType, headers, data) {
        if (!data || data.length === 0) {
            return;
        }

        const filePath = this.getFilePath(routeParams);

        if (!filePath) {
            return;
        }

        const dataCache = JSON.stringify({
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

        try {
            await fs.writeFile(filePath, dataCache);
        } catch (error) {
            console.log(`An error occurred writing file, ${filePath}, to the filesystem. Error: ${error}.`);
        }
    }

    getFilePath(routeParams) {
        if (!routeParams) {
            throw new Error('routeParams cannot be null or empty.');
        }

        const api = routeParams.isApiRequest ? 'api' : '';

        const namespace = '5ffd6089-2e7f-4cc8-9382-481051ff291e';
        const cacheKey = `${api}_${routeParams.language}_${routeParams.sitecoreRoute}`.toLowerCase();
        const hash = uuid(cacheKey, namespace);

        const filePath = `${path.join(process.cwd(), this.options.directory, hash)}.json`;
        return filePath;
    }

    static isCacheValid(expires) {
        if (!expires) {
            return false;
        }

        return (new Date().getTime() / 1000.0 < new Date(expires).getTime() / 1000.0);
    }
}

module.exports = FileCache;
