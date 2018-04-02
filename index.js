const fs = require('fs')
const path = require('path')
const { createBundleRenderer } = require('vue-server-renderer');
const tryRequire = require("./try-require");


let renderer, options, devMiddleware, hotMiddleware;

let isReady = false;

module.exports = (option) => {
    options = Object.assign({}, option);

    if (!isReady && process.env.NODE_ENV != 'production') {
        const SSRBuilder = tryRequire("flow-build");
        if (!SSRBuilder) {
            console.log("Please npm install --save-dev flow-build");
            throw new Error(
                '[flow-vue-ssr-middleware] SSRBuilder: true requires flow-build ' +
                  'as a peer dependency.'
            );
            return false;
        }

        let flowConfig = require(path.resolve(process.cwd(),'./flow.config.js'));
        let builder = new SSRBuilder(flowConfig);
        builder.build(createRenderer).then(data => {
            devMiddleware = data.devMiddleware;
            hotMiddleware = data.hotMiddleware;
            isReady = true;
        }).catch(e => {
            console.log(e)
            process.exit()
        });

        return Object.assign(middleware, {
            openBrowser: builder.openBrowser
        });
    } else {
        return middleware;
    }
}


async function middleware(...ctx) {
    let req, res, next;
    if (ctx[0].hasOwnProperty('req') && ctx[0].hasOwnProperty('res')) {
        req = ctx[0].req;
        res = ctx[0].res;
        next = ctx[1];
    } else {
        [req, res, next] = ctx;
    }

    if (process.env.NODE_ENV === 'production') {
        createRenderer();

        let result = await render(req, res);
        if (isBoolean(result) && result) {
            await next();
        } else {
            if (options.error) {
                options.error(result, req, res, next);
            } else {
                await next(result);
            }
        }
    } else {
        if (!isReady) {
            await waitFor(1000);
            return middleware(req, res, next)
        }
        
        let hasNext1 = await hotMiddleware(req, res, () => Promise.resolve(true));
        let hasNext2 = await devMiddleware(req, res, () => Promise.resolve(true));

        if (hasNext1 && hasNext2) {
            let result = await render(req, res);
            if (isBoolean(result) && result) {
                await next();
            } else {
                if (options.error) {
                    options.error(result, req, res, next);
                } else {
                    await next(result);
                }
            }
        }
    }
}


function createRenderer(mfs = fs) {
    const template = fs.readFileSync(options.template, 'utf-8')
    let distPath = path.resolve(process.cwd(), 'dist')

    const bundle = JSON.parse(mfs.readFileSync(path.resolve(distPath, './server-bundle.json'), "utf-8"))
    const clientManifest = JSON.parse(mfs.readFileSync(path.resolve(distPath, './vue-ssr-client-manifest.json'), "utf-8"));

    let option = {
        cache: false,
        basedir: distPath,
        runInNewContext: false,
        template,
        clientManifest
    }

    if (process.env.NODE_ENV === 'production' && options.cache) {
        option.cache = options.cache;   
    }

    renderer = createBundleRenderer(bundle, option)
}

function render (req, res) {
    return new Promise((resolve)=> {
        res.setHeader("Content-Type", "text/html")

        const context = Object.assign({
            url: req.url
        }, options.context);

        renderer.renderToString(context, (err, html) => {
            if (err) {
                return resolve(err)
            }
            res.send(html)
            resolve(true);
        })
    })
    
}


function waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms || 0))
}

function isBoolean(v) {
    return typeof v === "boolean"
}