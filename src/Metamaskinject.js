/*
 * Metamask Shim
 * @Author: John Trump
 * @Date: 2020-06-01 15:31:33
 * @LastEditors: John Trump
 * @LastEditTime: 2020-06-15 16:13:46
 * @FilePath: /src/Metamaskinject.js
 */

// 测试请打开
// const Web3 = require("web3");
/**
 * Extracts a name for the site from the DOM
 * 获取Dapps名称
 */
function getSiteName(window) {
  const { document } = window;

  const siteName = document.querySelector(
    'head > meta[property="og:site_name"]'
  );
  if (siteName) {
    return siteName.content;
  }

  const metaTitle = document.querySelector('head > meta[name="title"]');
  if (metaTitle) {
    return metaTitle.content;
  }

  if (document.title && document.title.length > 0) {
    return document.title;
  }

  return window.location.hostname;
}

export default class MetamaskInject {
  constructor(bridge) {
    this.bridge = bridge;
    this.wallet = "MEETONE"; // 可以判断 Metamask 的注入逻辑是否来自MEETONE钱包
    this.isMetaMask = true; // 毕竟我们是要模拟 Metamask 环境, 所以我们需要这样写
    this.selectedAddress = ""; // 当前ETH公钥地址
    this.siteMetadata = {
      name: getSiteName(window), //Dapps名称
      icon: "", // icon, 获取方法待定
    };
    /*
      TODO: 目前的 networkVersion 与 chainId为写死状态, 代表主网
      鉴于客户端当前并没有支持多个网络的ETH, 所以先写死
     */
    this.networkVersion = 1; // enum<number> -> '1': Ethereum Main Network
    this.chainId = "0x1";

    /** 兼容 metamask-specific convenience methods */
    this._metamask = new Proxy(
      {
        isEnabled: function() {
          return true;
        },
        isApproved: function() {
          return Promise.resolve(true);
        },
        isUnlocked: function() {
          return Promise.resolve(true);
        },
      },
      {
        get: function(obj, prop) {
          return obj[prop];
        },
      }
    );

    /*
        向页面注入 Metamask 补丁
     */
    if (typeof window == "object") {
      window.ethereum = this;
    }

    const web3 = new Web3(window.ethereum);
    window.web3 = web3;
    console.log('注入成功', window.web3)

    web3.setProvider = function() {
      log.debug("MEETONE - overrode web3.setProvider");
    };
  }
  isConnected() {
    return true;
  }
  /**
   * Requests the user provides an ethereum address to be identified by. Returns a promise of an array of hex-prefixed ethereum address strings
   *
   * @return Promise<string[]> 当前钱包账号公钥
   */
  async enable() {
    return new Promise((resolve) => {
      this.sendAsync({ method: "eth_requestAccounts" }, (_err, res) => {
        resolve(res.result);
      });
    });
  }

  /**
   * Sends a message to the web3 browser. Message format maps to the format of the Ethereum JSON-RPC API.
   *
   * https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sendtransaction
   *
   * Example: https://docs.metamask.io/guide/ethereum-provider.html#methods-current-api
   *
     interface JsonRpcResponse {
        id: string | undefined,
        jsonrpc: '2.0',
        method: string,
        result: any,
      }
   *
   * `ethereum.sendAsync(payload: Object, callback: Function): JsonRpcResponse`
   */
  sendAsync(payload, cb) {
    const { method, params } = payload;
    console.info("Receive Async Message: ");
    console.info(payload);
    // console.info(payload);
    switch (method) {
      case "eth_accounts":
      case "eth_requestAccounts": {
        // 如果本地已经有 selectedAddress 状态, 则不再发起协议去获取账号
        if (this.selectedAddress) {
          cb(null, {
            id: undefined,
            jsonrpc: undefined,
            // id: payload.id,
            // jsonrpc: payload.jsonrpc,
            result: [this.selectedAddress],
          });
          return;
        }
        this.bridge
          .customGenerate({
            routeName: "eth/account_info",
            params: {
              dappName: this.siteMetadata.name,
            },
          })
          .then((res) => {
            if (res.code == 0) {
              // TODO: address 是之前iOS客户端写的字段, 之后统一成了publicKey了
              let pbk = res.data.address || res.data.publicKey;
              pbk = pbk.toLowerCase();
              this.selectedAddress = pbk;
              window.web3.eth.defaultAccount = pbk;
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: [pbk],
              });
            } else {
              cb({ code: 4001, message: "User denied" }, null);
            }
          });
        break;
      }
      /** 签事务 */
      case "eth_sendTransaction": {
        // ref: https://docs.metamask.io/guide/sending-transactions.html#transaction-parameters
        let {
          // nonce = "0x00", // Nonce [ignored]
          gasPrice = "0x6fc23ac00",
          gas = "0x9c40",
          to, // string
          from = this.selectedAddress, // string, default is current address
          value = "0x00", // string,
          data = "0x00", // string
          // chainId = this.chainId
        } = params[0];

        this.bridge
          .customGenerate({
            routeName: "eth/transaction_send",
            params: {
              from,
              to,
              gasPrice,
              gas,
              value,
              data,
            },
          })
          .then((res) => {
            if (res.code == 0) {
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: res.data.txid,
              });
            } else {
              cb({ code: 4001, message: "User denied" }, null);
            }
          });
        break;
      }
      // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
      case "eth_sign": {
        const [from, message] = params;
        /* mock data */
        // cb(null, {
        //   id: payload.id,
        //   jsonrpc: payload.jsonrpc,
        //   result:
        //     "0xaa85078d9420b2ac275a71121f17e8cded803fca89af0725460f4bfa525eaa536a89c5f60e44635d2579442dbd56a960dc94717acb4c0c73f6a980de5ba4a2e01c",
        // });
        // return;
        this.bridge
          .customGenerate({
            routeName: "eth/eth_sign",
            params: {
              from,
              message,
            },
          })
          .then((res) => {
            if (res.code == 0) {
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: res.data.sig,
              });
            } else {
              cb({ code: 4001, message: "User denied" }, null);
            }
          });
        break;
      }
      /** sign - personal_sign */
      case "personal_sign": {
        const [msg, from] = params;
        // cb(null, {
        //   id: payload.id,
        //   jsonrpc: payload.jsonrpc,
        //   result:
        //     "0x4d4378882bf3b591dde496190365dce23962403ec7ff20cf7d49c5e12fdeaa5f2c842c2df53a9d75d177898042b06310dd62542f24042da168e65e701eb8c9521c",
        // });
        // return;
        this.bridge
          .customGenerate({
            routeName: "eth/personal_sign",
            params: {
              msg,
              from,
            },
          })
          .then((res) => {
            if (res.code == 0) {
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: res.data.sig,
              });
            } else {
              cb({ code: 4001, message: "User denied" }, null);
            }
          });
        break;
      }
      /** sign recover - personal_sign */
      case "personal_ecRecover": {
        let [text, sign] = params;
        // NOTE: eth.personal_ecRecover的参数中字符串前面加上了 `0x0`
        text = text.startsWith("0x0") ? text.slice(3) : text;
        /* mock data */
        // cb(null, {
        //   id: payload.id,
        //   jsonrpc: payload.jsonrpc,
        //   result: "0x49a8246758f8d28e348318183d9498496074ca71",
        // });
        // return;
        this.bridge
          .customGenerate({
            routeName: "eth/personal_ecRecover",
            params: {
              text,
              sign,
            },
          })
          .then((res) => {
            if (res.code == 0) {
              // success
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: res.data.pub,
              });
            } else {
              // failed
              cb({ code: 4001, message: "User denied" }, null);
            }
          });
        break;
      }

      default:
        console.warn("No implement method: " + method + " yet");
      // 此处不能抛出异常, 否则Dapps会崩溃
      // throw new Error("No implement method: " + method + " yet");
    }
  }

  _sendSync(payload) {
    console.info("Receive Sync Message: " + payload.method);
    let selectedAddress = this.selectedAddress;
    let result = null;
    switch (payload.method) {
      case "eth_accounts": {
        result = selectedAddress ? [selectedAddress] : [];
        break;
      }
      case "eth_coinbase": {
        result = selectedAddress || null;
        break;
      }
      case "eth_uninstallFilter": {
        result = true;
        break;
      }
      case "net_version": {
        result = this.networkVersion || null;
        break;
      }
    }

    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result: result,
    };
  }

  send(payload, callback) {
    console.info('========拦截到的Metamask协议[send]=========');
    console.info(payload);

    /* 如果这里有指定回调函数的参数, 意味着这是个异步操作, 走 `sendAsync` 的逻辑 */
    if (callback) {
      this.sendAsync(payload, callback);
    } else {
      /* 如果没有回调函数的参数, 则意味着这是个同步操作, 执行 `_sendSync` 的逻辑 */
      return this._sendSync(payload);
    }
  }

  /** 手机客户端没有在Dapps中 切换账号与切换网络的需求, 所以这个方法不予实现 */
  autoRefreshOnNetworkChange() {}
  /** 手机客户端没有在Dapps中 切换账号与切换网络的需求, 所以这个方法不予实现 */
  on() {}
}
