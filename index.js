const fs = require("fs");
const path = require("path");
const { createBundleRenderer } = require("vue-server-renderer");
const tryRequire = require("./try-require");

let renderer, options;

module.exports = async option => {
    options = Object.assign(
        {
            output: "./dist",
            error: (err, req, res) => {
                if (err.code === 404) {
                    res && res.status(404).send("404 | Page Not Found");
                } else {
                    res && res.status(500).send("500 | Internal Server Error");
                    console.error(`error during render : ${req.url}`);
                    console.error(err.stack || err);
                }
            }
        },
        option
    );

    if (process.env.NODE_ENV != "production") {
        const SSRBuilder = tryRequire("flow-build");
        if (!SSRBuilder) {
            console.log("Please npm install --save-dev flow-build");
            throw new Error(
                "[flow-vue-ssr-middleware] SSRBuilder: true requires flow-build " +
                    "as a peer dependency."
            );
            return false;
        }

        try {
            let flowConfig = require(path.resolve(
                process.cwd(),
                "./flow.config.js"
            ));
            let builder = new SSRBuilder(flowConfig);
            let { devMiddleware, hotMiddleware } = await builder.build(
                createRenderer
            );

            return {
                devMiddleware,
                hotMiddleware,
                middleware,
                openBrowser: builder.openBrowser
            };
        } catch (error) {
            console.error(error);
            process.exit(1);
        }
    } else {
        createRenderer();
        return {
            middleware
        };
    }
};

/**
 * 中间件
 * @param {*} ctx
 */
async function middleware(...ctx) {
    let req, res, next;
    if (ctx[0].hasOwnProperty("req") && ctx[0].hasOwnProperty("res")) {
        req = ctx[0].req;
        res = ctx[0].res;
        next = ctx[1];
    } else {
        [req, res, next] = ctx;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, HEAD");
        res.setHeader("Content-Length", "0");
        res.end();
        return;
    }

    if (req.path.indexOf(".") > 0) {
        res.redirect("/404?from=" + decodeURIComponent(req.url));
        return;
    }

    let result = await render(req, res);
    if (isBoolean(result) && result) {
        next();
    } else if (!result.url) {
        if (res.headersSent) {
            options.error(result, req);
        } else {
            options.error(result, req, res);
        }
    }
}

/**
 * 创建renderer实例
 * @param {*} mfs
 */
function createRenderer(mfs = fs) {
    const template = fs.readFileSync(options.template, "utf-8");
    let distPath = path.resolve(process.cwd(), options.output);

    const bundle = JSON.parse(
        mfs.readFileSync(
            path.resolve(distPath, "./server-bundle.json"),
            "utf-8"
        )
    );
    const clientManifest = JSON.parse(
        mfs.readFileSync(
            path.resolve(distPath, "./vue-ssr-client-manifest.json"),
            "utf-8"
        )
    );

    let option = {
        cache: false,
        basedir: distPath,
        runInNewContext: false,
        template,
        clientManifest
    };

    if (process.env.NODE_ENV === "production" && options.cache) {
        option.cache = options.cache;
    }

    renderer = createBundleRenderer(bundle, option);
}
/**
 * 渲染页面
 * @param {*} req
 * @param {*} res
 */
function render(req, res) {
    return new Promise(resolve => {
        let context = Object.assign(
            {
                req: req,
                res: res
            },
            options.context
        );

        renderer.renderToString(context, (err, html) => {
            if (err) {
                if (err.url) {
                    res.redirect(err.url);
                }
                return resolve(err);
            } else if (!res.headersSent && html) {
                res.setHeader("Content-Type", "text/html");
                res.send(html);
            }
            return resolve(true);
        });
    });
}

/**
 * 判断是否是bool值
 * @param {*} v
 */
function isBoolean(v) {
    return typeof v === "boolean";
}
