## Rollup 打包 JavaScript

https://juejin.im/post/5a9fe754f265da237d028f37

## 安装自己维护的 EOSJS

`npm install git://github.com/wujunchuan/eosjs.git#maintain-16.x.x --save`

## todolist

- [ ] 引入环境变量来判断`main.js`的注入逻辑

```js
// 伪代码
process.env.NODE_ENV === "production";
setTimeout(() => {
  // ...
});
```
