# Introduction

通过对主流的钱包SDK接口的模拟以实现Dapps在钱包的适配

## Rollup 打包 JavaScript

https://juejin.im/post/5a9fe754f265da237d028f37

## 安装自己维护的 EOSJS

eosjs@16.x.x版本官方已经不维护了, 但是有一些已知的bug不修复, 我们无法执行正确的结果

fork一份代码长期维护

但是建议Dapps开发者尽早转向还在维护中的eosjs@20.x.x

- 安装

`npm install git://github.com/wujunchuan/eosjs.git#maintain-16.x.x --save`

## 相关文档

- EOS -> Scatter
  - https://get-scatter.com/developers
- ETH -> Metamask

  - https://docs.metamask.io/guide/
  - https://eth.wiki/json-rpc/API

- Tron -> Tronscan

  - https://developers.tron.network/docs/getting-started_new