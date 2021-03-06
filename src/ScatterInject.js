/*
 * Scatter Shim
 * @Author: JohnTrump
 * @Date: 2019-03-28 10:38:23
 * @Last Modified by: JohnTrump
 * @Last Modified time: 2020-01-20 18:16:10
 */
// const Buffer = require('buffer/').Buffer  // note: the trailing slash is important!
import { Buffer } from "buffer/";
import _Eos_1 from "eosjs/lib/eos";

// 翻转Hex
function reverseHex(h) {
  return h.substr(6, 2) + h.substr(4, 2) + h.substr(2, 2) + h.substr(0, 2);
}

// 将对象元素转换成字符串以作比较
function obj2key(obj, keys) {
  var n = keys.length,
    key = [];
  while (n--) {
    key.push(obj[keys[n]]);
  }
  return key.join("|");
}
//去重操作
function uniqeByKeys(array, keys) {
  var arr = [];
  var hash = {};
  for (var i = 0, j = array.length; i < j; i++) {
    var k = obj2key(array[i], keys);
    if (!(k in hash)) {
      hash[k] = true;
      arr.push(array[i]);
    }
  }
  return arr;
}

/** 通知客户端变更流畅模式的开关 */
// 限制10s超时
function setSmoothCPUStatus(status) {
  let cp1 = new Promise((resolve, reject) => {
    window.meetBridge
      .customGenerate({
        routeName: "app/setSmoothCPUStatus",
        params: {
          status: !!status
        }
      })
      .then(res => {
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
  return timeoutPromise(cp1, 1000 * 10);
}

/** 获取CPU流畅模式开关 */
// 限制30s超时
function getSmoothCPUStatus() {
  let cp1 = new Promise((resolve, reject) => {
    window.meetBridge
      .customGenerate({
        routeName: "app/getSmoothCPUStatus"
      })
      .then(res => {
        if (res.code === 0) {
          let {
            status = false,
            info: {
              available = false,
              cpu_account,
              cpu_access,
              cpu_public,
              block_id,
              url
            }
          } = res.data;
          resolve({
            status,
            available,
            cpu_account,
            cpu_access,
            cpu_public,
            block_id,
            url
          });
        } else {
          reject(res);
        }
      })
      .catch(err => {
        reject(err);
      });
  });
  return timeoutPromise(cp1, 30 * 1000);
}

function delayPromise(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function timeoutPromise(promise, ms) {
  var timeout = delayPromise(ms).then(function() {
    throw new Error("OPERATION_TIME_OUT");
  });
  return Promise.race([promise, timeout]);
}

/* ScatterInject Class */
export default class ScatterInject {
  constructor(bridge) {
    this.bridge = bridge;
    if (typeof window == "object") {
      // 向页面注入Scatter补丁
      window.scatter = this;
      // Event Emit scatterLoaded
      document.dispatchEvent(new CustomEvent("scatterLoaded"), {});
    } else {
      // useless, because there haven't scatter support nodejs
      global.scatter = this;
    }

    // default Value
    this.isExtension = true;
    // MEETONE特有，可以用来判断是否是MEETONE钱包内，判断方法如下 `scatter.isInject`
    this.isInject = true;
    this.identity = null;
    this.cosignPublicKey = null; // 联合签名的公钥地址(客户端获取)
    this.publicKey = "";
    // 可以判断Scatter的注入逻辑是否来自MEETONE钱包
    this.wallet = "MEETONE";
    this.network = {
      // blockchain: 'eos', // default is EOS
      fullhost: function() {
        return this.protocol + "://" + this.host + ":" + this.port;
      }
    };
  }

  requireVersion(_version) {
    this.requiredVersion = _version;
  }

  useIdentity(identity) {
    this.identity = identity;
    this.publicKey = this.identity ? this.identity.publicKey : "";
  }

  connect() {
    return Promise.resolve(true);
  }

  // 登录
  login(requiredFields) {
    return this.getIdentity(requiredFields);
  }
  // 登录
  checkLogin() {
    return this.getIdentityFromPermissions();
  }
  // 登录
  getIdentityFromPermissions() {
    if (this.identity) {
      return Promise.resolve(this.identity);
    }
    return this.getIdentity();
  }

  // 退出登录
  logout() {
    this.identity = null;
    return Promise.resolve(true);
  }

  // 退出登录
  forgetIdentity() {
    this.identity = null;
    return Promise.resolve(true);
  }

  linkAccount(account, network) {
    if (
      this.identity &&
      account &&
      this.identity.publicKey === account.publicKey &&
      this.identity.accounts[0].name === account.name
    ) {
      return Promise.resolve(true);
    } else {
      return Promise.resolve(false);
    }
  }

  suggestNetwork(network) {
    return Promise.resolve(true);
  }

  // 获取公钥
  getPublicKey() {
    if (this.identity) {
      return Promise.resolve(this.identity.publicKey);
    }
    return Promise.resolve();
  }

  // 获取域名（非Scatter方法，自定）
  strippedHost() {
    if (typeof window == "object") {
      let e = location.hostname;
      return 0 === e.indexOf("www.") && (e = e.replace("www.", "")), e;
    } else {
      return "Host Undefined";
    }
  }

  isConnected() {
    return true;
  }

  getVersion() {
    return "10.1.2";
  }

  getIdentity(requiredFields) {
    var network = requiredFields && requiredFields.accounts[0];
    let blockchain = network && network.blockchain;
    /* chainId: network && network.chainId */
    return this.bridge
      .invokeAccountInfo({
        // Dapp所属的chainId
        chainId: network && network.chainId,
        // 当前Dapp名称
        dappName: document.title
      })
      .then(res => {
        if (res.code === 0) {
          // 原生客户端将权限permission回传给了网页，所以这里可以不单纯的使用isOwner/isActive来设置权限了
          // 这样可以适配更多非onwer/active权限
          let authority = "active"; // 假定权限为active
          let permissions = [];
          try {
            let hasActive = false;
            permissions = res.data && res.data.permission.split("&&");
            if (permissions.length === 1) {
              authority = permissions[0];
            } else {
              // 判断是否有active权限
              for (let i = 0; i < permissions.length; i++) {
                if (permissions[i] === "active") {
                  hasActive = true;
                }
              }
              // 缺少active权限，才会去默认取第一个权限
              if (!hasActive) {
                authority = permissions[0];
              }
            }
          } catch (error) {}
          var scatterIdentity = {
            accounts: [
              {
                authority: authority,
                blockchain: blockchain || "eos",
                name: res.data.account,
                publicKey: res.data.publicKey,
                isHardware: false
              }
            ],
            publicKey: res.data.publicKey,
            kyc: false,
            name: "MEETONE-" + res.data.account
          };
          this.identity = scatterIdentity;
          return scatterIdentity;
        }
        return {};
      });
  }

  requestTransfer(network, to, amount, tokenDetails) {
    // 原生的Scatter是支持选择帐号去付款的,现在手机客户端还不能
    if (!this.identity) {
      return Promise.reject();
    }

    // Scatter amount 传入的是字符串,而我们的桥接是number
    // 这里需要进行转换
    let str_amount = typeof amount === "string" ? amount.split(" ")[0] : "0";
    amount = Number(str_amount);

    let blockchain =
      (this.identity &&
        this.identity.accounts &&
        this.identity.accounts[0] &&
        this.identity.accounts[0].blockchain) ||
      "eos";

    return this.bridge
      .invokeTransfer({
        blockchain,
        amount: amount,
        to: to,
        memo: tokenDetails.memo || "",
        tokenContract: tokenDetails.contract,
        tokenName: tokenDetails.symbol,
        tokenPrecision: tokenDetails.decimals
      })
      .then(function(res) {
        if (res.code === 0) {
          return Promise.resolve(res.data);
        }
        return Promise.reject();
      });
  }

  getArbitrarySignature(publicKey, data, whatfor, isHash) {
    // set default values
    whatfor = whatfor || "";
    isHash = isHash || false;
    let blockchain =
      this.identity &&
      this.identity.accounts &&
      this.identity.accounts[0] &&
      this.identity.accounts[0].blockchain;
    return this.bridge
      .invokeSignature({
        publicKey: publicKey,
        data: data,
        blockchain: blockchain || "eos",
        whatfor: whatfor,
        isHash: isHash,
        isArbitrary: true
      })
      .then(function(res) {
        if (res.code === 0) {
          return Promise.resolve(res.data.signature);
        }
        return Promise.reject();
      });
  }

  authenticate(nonce) {
    /**
     * 工作流程：
     *  1. 客户端持有nonce+privateKey进行加密（备注，如果项目方没有提供nonce,默认为网页域名）
     *  2. 客户端返回签名sign
     *  3. 项目方拿到sign，根据publicKey进行解密，验证nonce是否一致
     */
    if (!this.identity) {
      Promise.reject("null");
      return;
    }

    let nonceData = nonce || this.strippedHost();
    let blockchain =
      this.identity &&
      this.identity.accounts &&
      this.identity.accounts[0] &&
      this.identity.accounts[0].blockchain;
    return this.bridge
      .invokeSignature({
        publicKey: this.identity.publicKey,
        data: nonceData,
        blockchain: blockchain || "eos",
        whatfor: "",
        isHash: false
      })
      .then(function(res) {
        if (res.code === 0) {
          return Promise.resolve(res.data.signature);
        }
        return Promise.reject();
      });
  }

  /** 签名逻辑 */
  signProvider(blockchain) {
    var _this = this;
    return function(signargs) {
      // 因为加了一层this, 在这里this指向不再是 `Scatterinject`类 所以在外层绑定this
      return _this.bridge
        .invokeSignProvider({
          blockchain: blockchain,
          buf: Array.from(signargs.buf),
          transaction: signargs.transaction.actions
        })
        .then(function(res) {
          if (res.code === 0) {
            let sign = res.data.signature;
            let signatures = [];
            signatures = sign instanceof Array ? [...sign] : [sign];
            if (signargs.beta3) {
              return {
                signatures,
                serializedTransaction: Buffer.from(
                  signargs.serializedTransaction,
                  "hex"
                )
              };
            }
            return signatures;
          }
        });
    };
  }

  eos(network, Eos, eosOptions = {}, protocol) {
    if (eosOptions && eosOptions.rpc) {
      return this.eosGenerate_2(network, Eos, eosOptions, protocol);
    } else {
      // 将EOSjs替换为我们自己维护的版本
      let _Eos = _Eos_1;
      return this.eosGenerate_1(network, _Eos, eosOptions, protocol);
    }
  }

  /**
   * Eosjs@20+
   */
  hookProvider(network, requiredFields, beta3, api) {
    var _this = this;
    // Scatter source code here
    // https://github.com/GetScatter/scatter-js/blob/b4155e3ae1fda4af6cabbb4f34c2606387c477e7/packages/plugin-eosjs2/src/index.js#L23
    return {
      requiredFields: {},
      /** 获取操作所需要的公钥 */
      getAvailableKeys: function() {
        let avaliableKeys = [];
        avaliableKeys =
          _this.cosignPublicKey && _this.identity
            ? [_this.cosignPublicKey, _this.identity.publicKey]
            : [_this.identity.publicKey];
        return avaliableKeys;
      },
      /**
       * 转换成客户端签名
       */
      sign: function(signargs) {
        let buffer = Buffer.from(signargs.serializedTransaction, "hex");
        signargs.serializedTransaction = Buffer.from(
          signargs.serializedTransaction
        ).toString("hex");
        signargs.transaction = api.deserializeTransaction(buffer);
        signargs.beta3 = beta3;
        signargs.buf = Buffer.concat([
          new Buffer(signargs.chainId, "hex"), // Chain ID
          buffer, // Transaction
          new Buffer(new Uint8Array(32)) // Context free actions
        ]);
        return _this.signProvider("eos")(signargs);
      }
    };
  }
  /** eosjs@16 */
  eosGenerate_1(network, Eos, eosOptions = {}, protocol) {
    // eosjs1的逻辑
    this.network = Object.assign(this.network, network);
    let blockchain = this.network.blockchain || "eos";
    if (!network.protocol) {
      network.protocol = protocol || "http";
    }
    let httpEndpoint =
      network.protocol + "://" + network.host + ":" + network.port;
    let chainId = network.chainId;
    let eos = Eos(
      Object.assign(eosOptions, {
        httpEndpoint,
        chainId,
        signProvider: this.signProvider(blockchain)
      })
    );

    eos._transaction = eos.transaction;
    let _this = this;
    eos.transaction = function(...args) {
      return new Promise((resolve, reject) => {
        getSmoothCPUStatus()
          .then(
            ({
              status,
              available,
              cpu_account,
              cpu_access,
              cpu_public,
              block_id
            }) => {
              if (status && available) {
                _this.cosignPublicKey = cpu_public;
                let _transaction = args[0];
                let _actions = _transaction.actions;
                // 检查是否自带联合签名
                let cosignbefore = _actions.every(action => {
                  action.authorization = uniqeByKeys(action.authorization, [
                    "actor",
                    "permission"
                  ]);
                  return action.authorization.length > 1;
                });
                if (cosignbefore) {
                  // 不走代签逻辑
                  // 通知客户端关闭代签按钮, 事后恢复
                  setSmoothCPUStatus(false)
                    .then(res => {})
                    .catch(err => {})
                    .finally(() => {
                      eos
                        ._transaction(...args)
                        .then(res => {
                          resolve(res);
                        })
                        .catch(err => {
                          reject(err);
                        })
                        .finally(() => {
                          setSmoothCPUStatus(true);
                        });
                    });
                  return;
                }
                _actions.map(action => {
                  action.authorization = [
                    {
                      actor: cpu_account, // use account that was logged in
                      permission: cpu_access
                    },
                    ...action.authorization
                  ];
                  action.authorization = uniqeByKeys(action.authorization, [
                    "actor",
                    "permission"
                  ]);
                  return action;
                });
                /**
                 * Decode from block_id
                 * `ref_block_num`
                 * `ref_block_prefix
                 */
                if (block_id) {
                  _transaction = Object.assign(_transaction, {
                    ref_block_num: parseInt(block_id.substr(0, 8), 16) & 0xffff,
                    ref_block_prefix: parseInt(
                      reverseHex(block_id.substr(16, 8)),
                      16
                    )
                  });
                }
                eos
                  ._transaction(...args)
                  .then(res => resolve(res))
                  .catch(err => reject(err));
              } else {
                // 去重, 防止用户在页面打开后, 操作开关, 产生两个相同authorization的bug
                let _transaction = args[0];
                let _actions = _transaction.actions;
                _actions.every(action => {
                  action.authorization = uniqeByKeys(action.authorization, [
                    "actor",
                    "permission"
                  ]);
                  return action.authorization.length > 1;
                });
                eos
                  ._transaction(...args)
                  .then(res => resolve(res))
                  .catch(err => reject(err));
              }
            }
          )
          .catch(err => {
            // 客户端响应超时
            if (err.message == "OPERATION_TIME_OUT") {
              eos
                ._transaction(...args)
                .then(res => resolve(res))
                .catch(err => reject(err));
            }
          });
      });
    };

    return eos;
  }

  /** eosjs@20 */
  eosGenerate_2(network, Eos, eosOptions = {}, protocol) {
    let requiredFields = {};
    // eosjs2 Eos 实例为 Api
    const api = new Eos({ rpc: eosOptions.rpc });
    let signatureProvider = this.hookProvider(
      network,
      requiredFields,
      eosOptions.beta3 || false,
      api
    );
    const eos = new Eos(
      Object.assign(eosOptions, {
        signatureProvider: signatureProvider
      })
    );

    eos._transact = eos.transact;
    let _this = this;
    eos.transact = function(...args) {
      return new Promise((resolve, reject) => {
        getSmoothCPUStatus()
          .then(
            ({
              status,
              available,
              cpu_account,
              cpu_access,
              cpu_public,
              block_id
            }) => {
              /* 服务可用 */
              if (status && available) {
                // 走代签逻辑
                _this.cosignPublicKey = cpu_public;
                let _transaction = args[0];
                let _actions = _transaction.actions;
                // 检查是否自带联合签名
                let cosignbefore = _actions.every(action => {
                  action.authorization = uniqeByKeys(action.authorization, [
                    "actor",
                    "permission"
                  ]);
                  return action.authorization.length > 1;
                });
                if (cosignbefore) {
                  // 不走代签逻辑
                  // 通知客户端关闭代签按钮, 事后恢复
                  setSmoothCPUStatus(false)
                    .then(res => {})
                    .catch(err => {})
                    .finally(() => {
                      eos
                        ._transaction(...args)
                        .then(res => {
                          resolve(res);
                        })
                        .catch(err => {
                          reject(err);
                        })
                        .finally(() => {
                          setSmoothCPUStatus(true);
                        });
                    });
                  return;
                }
                _actions.map(action => {
                  action.authorization = [
                    {
                      actor: cpu_account, // use account that was logged in
                      permission: cpu_access
                    },
                    ...action.authorization
                  ];
                  action.authorization = uniqeByKeys(action.authorization, [
                    "actor",
                    "permission"
                  ]);
                  return action;
                });
                /**
                 * Decode from block_id
                 * `ref_block_num`
                 * `ref_block_prefix
                 */
                if (block_id) {
                  _transaction = Object.assign(_transaction, {
                    ref_block_num: parseInt(block_id.substr(0, 8), 16) & 0xffff,
                    ref_block_prefix: parseInt(
                      reverseHex(block_id.substr(16, 8)),
                      16
                    )
                  });
                }
                eos
                  ._transact(...args)
                  .then(res => resolve(res))
                  .catch(err => reject(err));
              } else {
                /* 服务不可用
                 * 去重, 防止用户在页面打开后, 操作开关, 产生两个相同的authorization的BUG
                 */
                let _transaction = args[0];
                let _actions = _transaction.actions;
                _actions.every(action => {
                  action.authorization = uniqeByKeys(action.authorization, [
                    "actor",
                    "permission"
                  ]);
                  return action.authorization.length > 1;
                });
                eos
                  ._transact(...args)
                  .then(res => resolve(res))
                  .catch(err => reject(err));
              }
            }
          )
          .catch(err => {
            // 客户端响应超时
            if (err.message == "OPERATION_TIME_OUT") {
              eos
                ._transact(...args)
                .then(res => resolve(res))
                .catch(err => reject(err));
            }
          });
      });
    };

    return eos;
  }
}
