/*
 * Metamask Shim
 * @Author: John Trump
 * @Date: 2020-06-01 15:31:33
 * @LastEditors: John Trump
 * @LastEditTime: 2020-07-31 14:38:30
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
    this.networkVersion = "1"; // enum<string> -> '1': Ethereum Main Network
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
    console.log("注入成功", window.web3);

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

  // Example POST method implementation:
  async postData(url = "", data = {}) {
    // Default options are marked with *
    const response = await fetch(url, {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      // mode: "cors", // no-cors, *cors, same-origin
      // cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      // credentials: "same-origin", // include, *same-origin, omit
      headers: {
        "Content-Type": "application/json",
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      // redirect: "follow", // manual, *follow, error
      // referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: JSON.stringify(data), // body data type must match "Content-Type" header
    });
    return response.json(); // parses JSON response into native JavaScript objects
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
    // console.info("Receive Async Message: ");
    // console.info(payload);
    console.log({method, params});
    switch (method) {
      case "eth_chainId": {
        cb(null, {
          id: payload.id,
          jsonrpc: payload.jsonrpc,
          result: this.networkVersion,
        });
        break;
      }
      case "eth_getBlockByHash": {
        this.bridge
          .customGenerate({
            routeName: "eth/eth_getBlockByHash",
            params: {
              params0: params[0],
              params1: params[1],
            },
          })
          .then((res) => {
            if (res.code == 0) {
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: JSON.parse(res.data.result),
              });
            } else {
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });
        break;
      }
      case "eth_getBlockByNumber": {
        this.bridge
          .customGenerate({
            routeName: "eth/eth_getBlockByNumber",
            params: {
              params0: params[0],
              params1: params[1],
            },
          })
          .then((res) => {
            if (res.code == 0) {
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: JSON.parse(res.data.result),
              });
            } else {
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });
        break;
      }
      case "eth_getTransactionByHash": {
        this.bridge
          .customGenerate({
            routeName: "eth/eth_getTransactionByHash",
            params: {
              params0: params[0],
            },
          })
          .then((res) => {
            if (res.code == 0) {
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: JSON.parse(res.data.result),
              });
            } else {
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });
        break;
      }
      case "eth_blockNumber": {
        this.bridge
          .customGenerate({
            routeName: "eth/eth_blockNumber",
            params: {},
          })
          .then((res) => {
            if (res.code == 0) {
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: res.data.blockNumber,
              });
            } else {
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });

        break;
      }
      /** 根据地址余额 */
      case "eth_getBalance": {
        const [address, tag = "latest"] = params;
        this.bridge
          .customGenerate({
            routeName: "eth/eth_getBalance",
            params: {
              address,
              tag,
            },
          })
          .then((res) => {
            if (res.code == 0) {
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: res.data.balance,
              });
            } else {
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });
        break;
      }
      case "eth_coinbase": {
        cb(null, {
          id: payload.id,
          jsonrpc: payload.jsonrpc,
          result: this.selectedAddress,
        });
        break;
      }
      case "eth_uninstallFilter": {
        cb(null, {
          id: payload.id,
          jsonrpc: payload.jsonrpc,
          result: true,
        });
        break;
      }
      case "net_version": {
        cb(null, {
          id: payload.id,
          jsonrpc: payload.jsonrpc,
          result: this.networkVersion || null,
        });
        break;
      }
      case "eth_accounts":
      case "eth_requestAccounts": {
        // 如果本地已经有 selectedAddress 状态, 则不再发起协议去获取账号
        if (this.selectedAddress) {
          cb(null, {
            id: payload.id,
            jsonrpc: payload.jsonrpc,
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
              // address 是之前iOS客户端写的字段, 之后统一成了publicKey了
              let pbk = res.data.publicKey;
              pbk = pbk.toLowerCase();
              this.selectedAddress = pbk;
              window.web3.eth.defaultAccount = pbk;
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: [pbk],
              });
            } else {
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });
        break;
      }
      /** 签事务 */
      case "eth_sendTransaction": {
        // ref: https://docs.metamask.io/guide/sending-transactions.html#transaction-parameters
        let {
          // nonce = "0x00", // Nonce [ignored]
          gasPrice,
          gas,
          to, // string
          from = this.selectedAddress, // string, default is current address
          value,
          data,
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
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });
        break;
      }

      // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
      case "eth_sign": {
        const [from, message] = params;
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
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });
        break;
      }
      /** sign - personal_sign */
      case "personal_sign": {
        const [msg, from] = params;
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
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });
        break;
      }
      /** sign recover - personal_sign */
      case "personal_ecRecover": {
        let [text, sign] = params;
        // NOTE: eth.personal_ecRecover的参数中字符串前面加上了 `0x0`
        text = text.startsWith("0x0") ? text.slice(3) : text;
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
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });
        break;
      }

      /* attempt to try call JSON-PRC [eth_call, eth_estimateGas]*/
      case "eth_call":
      case "eth_estimateGas": {
        this.postData("https://api.infura.io/v1/jsonrpc/mainnet", {
          jsonrpc: payload.jsonrpc,
          id: payload.id,
          method: method,
          params: params,
        })
          .then((response) => {
            cb(null, {
              id: payload.id,
              jsonrpc: payload.jsonrpc,
              result: response.result,
            });
          })
          .catch((err) => {
            console.log(err);
          });
        break;
      }

      default: {
        // https://eth.wiki/json-rpc/API
        this.bridge
          .customGenerate({
            routeName: `eth/${method}`,
            params: {
              params0: params[0],
              params1: params[1],
              params2: params[2],
              params3: params[3],
              params4: params[4],
              params5: params[5],
              params6: params[6],
              params7: params[7],
              params8: params[8],
              params9: params[9],
              params10: params[10],
            },
          })
          .then((res) => {
            if (res.code == 0) {
              cb(null, {
                id: payload.id,
                jsonrpc: payload.jsonrpc,
                result: res.data.result,
              });
            } else {
              cb({ code: 4001, message: "User denied", method: method }, null);
            }
          });
      }
    }
  }

  _sendSync(payload) {
    // console.info("Receive Sync Message: " + JSON.stringify(payload));
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
    // console.info("========拦截到的Metamask协议[send]=========");
    // console.info(payload);

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
