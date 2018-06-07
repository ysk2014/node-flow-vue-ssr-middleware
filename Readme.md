## 基于flow-build，创建的支持vue服务端渲染（vue-ssr）的中间件

> 本中间件是对`vue-server-renderer`封装，实现vue在服务端渲染的功能

### 功能

- 服务端渲染vue组件


### 说明

- 本中间件只支持`express`框，不支持`koa2`，未来会对`koa2`进行支持
- 本中间件是`flow-build`生态中的一个环节，如果想使用本中间件，请结合`flow-build`使用
- 本中间应为服务端最后一个中间件，如果在其后插入中间件，不会生效


### 安装

```js
npm install --save flow-vue-ssr-middleware
```

## 使用

```js
const fs = require('fs')
const path = require('path')
const LRU = require('lru-cache')
const express = require('express')
const favicon = require('serve-favicon')
const vueSSRMiddleware = require("flow-vue-ssr-middleware");
const resolve = file => path.resolve(__dirname, file)



const isProd = process.env.NODE_ENV === 'production'

const app = express()

const serve = (path, cache) => express.static(resolve(path), {
  maxAge: cache && isProd ? 1000 * 60 * 60 * 24 * 30 : 0
})

app.use(favicon('./public/logo-48.png'))

// static
app.use('/static', serve('./dist/static', true))

let instance = vueSSRMiddleware({
  template: resolve('./src/index.template.html'),
  context: {
    title: 'Vue 2.0'
  }
});

app.use(instance);

const port = process.env.PORT || 3000

app.listen(port, () => {
  console.log(`server started at localhost:${port}`)
  instance.openBrowser && instance.openBrowser("localhost", port);
})

```

### 参数

#### template

模板路径，可以参考`vue-server-renderer`模块下的`template`参数

#### cache

```js
const LRU = require("lru-cache");
const vueSSRMiddleware = require("flow-vue-ssr-middleware");

let instance = vueSSRMiddleware({
  ...
  cache: LRU({
    max: 10000,
    maxAge: ...
  })
});

```

#### context

本模块继承了`vue-server-renderer`向模板里面插入数据的功能，本参数就是传入模板下的数据

```js
const vueSSRMiddleware = require("flow-vue-ssr-middleware");

let instance = vueSSRMiddleware({
  template: resolve('./src/index.template.html'),
  context: {
    title: 'Vue 2.0'
  }
});
```

html文件

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>{{ title }}</title>
    <meta charset="utf-8">
  </head>
  <body>
  <!--vue-ssr-outlet-->
  </body>
</html>
```

#### error

添加一个错误处理中间件

```js
let instance = vueSSRMiddleware({
  template: resolve('./src/index.template.html'),
  context: {
    title: 'Vue HN 2.0', // default title
  },
  error: (err, req, res)=> {
      if (err.code === 404) {
        res && res.status(404).send('404 | Page Not Found')
      } else {
        // Render Error Page or Redirect
        rs && res.status(500).send('500 | Internal Server Error')
        console.error(`error during render : ${req.url}`)
        console.error(err.stack)
      }
  }
});
```

### 方法

#### openBrowser

参数：host，port

注意：此方法只有在开发模式下，才会存在