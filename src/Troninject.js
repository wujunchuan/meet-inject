/*
 * Tron协议支持
 * @Author: John Trump
 * @Date: 2020-09-06 16:01:33
 * @LastEditors: John Trump
 * @LastEditTime: 2020-09-07 15:07:43
 */

// node_modules/tronweb/dist/TronWeb.js
/* 这里需要指定引入的TronWeb为 browser 版本 */
import TronWeb from "tronweb/dist/TronWeb";
import axios from "axios";

const { HttpProvider } = TronWeb.providers;
class ProxiedProvider extends HttpProvider {
  constructor() {
    super("http://127.0.0.1");
    this.ready = false;
    this.queue = [];
  }

  /* 配置节点 */
  configure(url) {
    this.host = url;
    this.instance = axios.create({
      baseURL: url,
      timeout: 30000,
    });
    this.ready = true;

    while (this.queue.length) {
      const { args, resolve, reject } = this.queue.shift();
      this.request(...args)
        .then(resolve)
        .catch(reject)
        .then(() => console.log(`Completed the queued request to ${args[0]}`));
    }
  }

  request(endpoint, payload = {}, method = "get") {
    if (!this.ready) {
      return new Promise((resolve, reject) => {
        this.queue.push({
          args: [endpoint, payload, method],
          resolve,
          reject,
        });
      });
    }

    return super.request(endpoint, payload, method).then((res) => {
      const response = res.transaction || res;

      Object.defineProperty(response, "__payload__", {
        writable: false,
        enumerable: false,
        configurable: false,
        value: payload,
      });

      return res;
    });
  }
}

/** 判断是否为函数 */
function isFunction(obj) {
  return typeof obj === "function";
}

/** A minimalistic package to insert a promise instead of using a callback. */
function injectPromise(func, ...args) {
  return new Promise((resolve, reject) => {
    func(...args, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

export const Troninject = {
  bridge: null,
  proxiedMethods: {
    setAddress: false,
    sign: false,
  },

  init(bridge) {
    this.bridge = bridge;
    this.wallet = "MEETONE";
    this._bindTronWeb();

    // MOCK: 假装获取账号
    // setTimeout(() => {
    //   const {
    //     address = "TXkbFKruLen8YYaWUWgs4AS34L2wZCw83E",
    //     name = "ifucksun",
    //     type = 1,
    //     node = {
    //       eventServer: "https://api.shasta.trongrid.io",
    //       fullNode: "https://api.shasta.trongrid.io",
    //       solidityNode: "https://api.shasta.trongrid.io",
    //     },
    //   } = {};
    //   if (address) this.setAddress({ address, name, type });
    //   if (node.fullNode) this.setNode(node);
    //   console.log("MEETONE-Tron initiated");
    // }, 1000);

    this.bridge
      .customGenerate({
        routeName: "tron/init",
        params: {},
      })
      .then((res) => {
        if (res.code == 0) {
          const {
            address,
            name,
            type,
            node
          } = res.data;
          if (address) this.setAddress({ address, name, type });
          if (node.fullNode) this.setNode(node);
          console.log("MEETONE-Tron initiated");
        } else {
          throw new Error(JSON.stringify(res));
        }
      })
      .catch((err) => {
        console.error("Failed to initialise TronWeb", err);
      });
  },

  _bindTronWeb() {
    if (window.tronWeb !== undefined)
      console.warn(
        "TronWeb is already initiated. MEETONE will overwrite the current instance"
      );

    const tronWeb = new TronWeb(
      new ProxiedProvider(),
      new ProxiedProvider(),
      new ProxiedProvider()
    );

    tronWeb.extension = {}; //add a extension object for black list
    /* 将原生的方法存储起来 */
    this.proxiedMethods = {
      setAddress: tronWeb.setAddress.bind(tronWeb),
      sign: tronWeb.trx.sign.bind(tronWeb),
    };

    /* 以下方法禁止 */
    [
      "setPrivateKey",
      "setAddress",
      "setFullNode",
      "setSolidityNode",
      "setEventServer",
    ].forEach((method) => {
      tronWeb[method] = () => new Error("MEETONE has disabled this method");
    });

    tronWeb.trx.sign = (...args) => this.sign(...args);
    /* 将我们封装的 `tronweb` 挂载到 `window` 对象上 */
    window.tronWeb = tronWeb;
  },

  /** 设置地址 */
  setAddress({ address, name, type }) {
    if (!tronWeb.isAddress(address)) {
      tronWeb.defaultAddress = {
        hex: false,
        base58: false,
      };
      tronWeb.ready = false;
    } else {
      this.proxiedMethods.setAddress(address);
      tronWeb.defaultAddress.name = name;
      tronWeb.defaultAddress.type = type;
      tronWeb.ready = true;
    }
  },
  /** 设置节点 */
  setNode(node) {
    tronWeb.fullNode.configure(node.fullNode);
    tronWeb.solidityNode.configure(node.solidityNode);
    tronWeb.eventServer.configure(node.eventServer);
  },
  /** 签名 */
  sign(
    transaction,
    privateKey = false,
    useTronHeader = true,
    callback = false
  ) {
    if (isFunction(privateKey)) {
      callback = privateKey;
      privateKey = false;
    }

    if (isFunction(useTronHeader)) {
      callback = useTronHeader;
      useTronHeader = true;
    }

    if (!callback) {
      /* 将callback转换成promise */
      return injectPromise(
        this.sign.bind(this),
        transaction,
        privateKey,
        useTronHeader
      );
    }

    if (privateKey) {
      /* 使用原生sign */
      return this.proxiedMethods.sign(
        transaction,
        privateKey,
        useTronHeader,
        callback
      );
    }

    if (!transaction) return callback("Invalid transaction provided");
    if (!tronWeb.ready) return callback("User has not unlocked wallet");
    // setTimeout(() => {
    //   callback(null, {
    //     "visible": false,
    //     "txID": "cd9a98478a15111a7b01447a53d03acc55e8543fb23e8ee65cbbf9e29fc63180",
    //     "raw_data": {
    //       "contract": [
    //         {
    //           "parameter": {
    //             "value": {
    //               "amount": 10,
    //               "owner_address": "41eeefee0429b8fe7c5f9f05c8dce329d8e1680caa",
    //               "to_address": "41859009fd225692b11237a6ffd8fdba2eb7140cca"
    //             },
    //             "type_url": "type.googleapis.com/protocol.TransferContract"
    //           },
    //           "type": "TransferContract"
    //         }
    //       ],
    //       "ref_block_bytes": "c867",
    //       "ref_block_hash": "7f50d8d00c1ee499",
    //       "expiration": 1599459375000,
    //       "timestamp": 1599459317337
    //     },
    //     "raw_data_hex": "0a02c86722087f50d8d00c1ee4994098efd4b9c62e5a65080112610a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412300a1541eeefee0429b8fe7c5f9f05c8dce329d8e1680caa121541859009fd225692b11237a6ffd8fdba2eb7140cca180a70d9acd1b9c62e",
    //     "signature": [
    //       "dfe692d76283f3a9d54f083c9469410aa4c070ff00defb3b8b904db8619185102b45ae81c105a5a7ef5f65aabced4e27fcf5739958c819ddf58fd9b08fd4eef701"
    //     ]
    //   })
    // }, 1000);
    // return;

    this.bridge
      .customGenerate({
        routeName: "tron/sign",
        params: {
          transaction,
          useTronHeader,
          input:
            typeof transaction === "string"
              ? transaction
              : transaction.__payload__ ||
                transaction.raw_data.contract[0].parameter.value,
        },
      })
      .then((res) => {
        if (res.code == 0) {
          callback(null, res.data);
        } else {
          throw new Error(JSON.stringify(res));
        }
      })
      .catch((err) => {
        console.error("Failed to sign transaction:", err);
        callback(err);
      });
  },
};
