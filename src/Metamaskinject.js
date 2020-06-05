/*
 * Metamask Shim
 * @Author: John Trump
 * @Date: 2020-06-01 15:31:33
 * @LastEditors: John Trump
 * @LastEditTime: 2020-06-05 20:00:51
 * @FilePath: /Users/wujunchuan/Project/source/meet-inject/src/Metamaskinject.js
 */

// import "web3/dist/web3.min.js";
// require("web3/dist/web3.min.js");
var Web3 = require("web3");

export default class MetamaskInject {
  constructor(bridge) {
    this.bridge = bridge;
    this.wallet = "MEETONE"; // 可以判断 Metamask 的注入逻辑是否来自MEETONE钱包
    this.isMetaMask = true; // 毕竟我们是要模拟 Metamask 环境, 所以我们需要这样写
    this.selectedAddress = ""; // 当前ETH公钥地址
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
        isApproved: async function() {
          return true;
        },
        isUnlocked: async function() {
          return true;
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

    /* setup web3 */
    if (typeof window.web3 !== "undefined") {
      // throw new Error(`MEETONE detected another web3.
      // MEETONE will not work reliably with another web3 extension.
      // This usually happens if you have two wallet installed,
      // or MEETONE and another web3 extension. Please remove one
      // and try again.`);
    }

    const web3 = new Web3(window.ethereum);
    window.web3 = web3;

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
    // console.log('========拦截到的Metamask协议[sendAsync]=========');
    // console.log(payload);
    switch (method) {
      case "eth_requestAccounts": {
        this.bridge
          .customGenerate({
            routeName: "eth/account_info",
            params: {
              // TODO: 获取Dapps名称的逻辑
              dappName: "Dapp的名字",
            },
          })
          .then((res) => {
            if (res.code == 0) {
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
      /** 发送事务 */
      case "eth_sendTransaction": {
        this.bridge
          .customGenerate({
            routeName: "eth/transaction_send",
            params: params[0],
          })
          .then((res) => {
            if (res.code == 0) {
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: res.result,
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
                result: res.data,
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
                result: res.data,
              });
            } else {
              cb({ code: 4001, message: "User denied" }, null);
            }
          });
        break;
      }
      /** sign recover - personal_sign */
      case "personal_ecRecover": {
        const [text, sign] = params;
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
                result: res.data,
              });
            } else {
              // failed
              cb({ code: 4001, message: "User denied" }, null);
            }
          });
        break;
      }

      default:
        throw new Error("No implement method: " + method + " yet");
    }
  }

  _sendSync(payload) {
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
    // console.log('========拦截到的Metamask协议[send]=========');
    // console.log(payload);
    if (callback) {
      this.sendAsync(payload, callback);
    } else {
      return this._sendSync(payload);
    }
  }

  /** 手机客户端没有在Dapps中 切换账号与切换网络的需求, 所以这个方法不予实现 */
  autoRefreshOnNetworkChange() {}
  /** 手机客户端没有在Dapps中 切换账号与切换网络的需求, 所以这个方法不予实现 */
  on() {}
}
