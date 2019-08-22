/*
 * Scatter Shim
 * @Author: JohnTrump
 * @Date: 2019-03-28 10:38:23
 * @Last Modified by: JohnTrump
 * @Last Modified time: 2019-08-22 16:01:09
 */
// const Buffer = require('buffer/').Buffer  // note: the trailing slash is important!
import {Buffer} from 'buffer/';

export default class ScatterInject {
  constructor() {
    if (typeof window == 'object') {
      // 向页面注入Scatter补丁
      window.scatter = this;
      // Event Emit scatterLoaded
      document.dispatchEvent(new CustomEvent('scatterLoaded'), {});
    } else {
      // useless, because there haven't scatter support nodejs
      global.scatter = this;
    }

    // default Value
    this.isExtension = true;
    // MEETONE特有，可以用来判断是否是MEETONE钱包内，判断方法如下 `scatter.isInject`
    this.isInject = true;
    this.identity = null;
    this.publicKey = '';
    // 可以判断Scatter的注入逻辑是否来自MEETONE钱包
    this.wallet = 'MEETONE';
    this.network = {
      // blockchain: 'eos', // default is EOS
      fullhost: function () {
        return this.protocol + '://' + this.host + ':' + this.port
      }
    }
  }

  requireVersion(_version) {
    this.requiredVersion = _version;
  }

  useIdentity(identity) {
    this.identity = identity;
    this.publicKey = this.identity ? this.identity.publicKey : '';
  }

  connect() {
    return Promise.resolve(true);
  }

  // 登录
  login() {
    return this.getIdentity();
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
    if (this.identity && account && this.identity.publicKey === account.publicKey && this.identity.accounts[0].name === account.name) {
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
    if (typeof window == 'object') {
      let e = location.hostname;
      return 0 === e.indexOf("www.") && (e = e.replace("www.", "")), e
    } else {
      return 'Host Undefined';
    }
  }

  isConnected() {
    return true;
  }

  getVersion() {
    return '10.1.2';
  }

  getIdentity(requiredFields) {
    var network = requiredFields && requiredFields.accounts[0];
    let blockchain = network && network.blockchain;
    return meetBridge.invokeAccountInfo().then((res) => {
      if (res.code === 0) {
        // 原生客户端将权限permission回传给了网页，所以这里可以不单纯的使用isOwner/isActive来设置权限了
        // 这样可以适配更多非onwer/active权限
        let authority = 'active'; // 假定权限为active
        let permissions = [];
        try {
          let hasActive = false;
          permissions = res.data && res.data.permission.split('&&');
          if (permissions.length === 1) {
            authority = permissions[0];
          } else {
            // 判断是否有active权限
            for (let i = 0; i < permissions.length; i++) {
              if (permissions[i] === 'active') {
                hasActive = true;
              }
            }
            // 缺少active权限，才会去默认取第一个权限
            if (!hasActive) {
              authority = permissions[0];
            }
          }
        } catch (error) {

        }
        var scatterIdentity = {
          accounts: [{
            authority: authority,
            blockchain: blockchain || "eos",
            name: res.data.account,
            publicKey: res.data.publicKey,
            isHardware: false
          }],
          publicKey: res.data.publicKey,
          kyc: false,
          name: 'MEETONE-' + res.data.account
        }
        this.identity = scatterIdentity;
        return scatterIdentity;
      }
      return {}
    });
  }

  requestTransfer(network, to, amount, tokenDetails) {
    // 原生的Scatter是支持选择帐号去付款的,现在手机客户端还不能
    if (!this.identity) {
      return Promise.reject();
    }

    // Scatter amount 传入的是字符串,而我们的桥接是number
    // 这里需要进行转换
    let str_amount = typeof amount === 'string' ? amount.split(' ')[0] : '0';
    amount = Number(str_amount);

    let blockchain = this.identity && this.identity.accounts && this.identity.accounts[0] && this.identity.accounts[0].blockchain || 'eos';

    return meetBridge.invokeTransfer({
      blockchain,
      amount: amount,
      to: to,
      memo: tokenDetails.memo || '',
      tokenContract: tokenDetails.contract,
      tokenName: tokenDetails.symbol,
      tokenPrecision: tokenDetails.decimals
    }).then(function (res) {
      if (res.code === 0) {
      // TODO: 回调问题等客户端修复
        return Promise.resolve(res.data);
      }
      return Promise.reject();
    });
  }

  getArbitrarySignature(publicKey, data, whatfor, isHash) {
    // set default values
    whatfor = whatfor || '';
    isHash = isHash || false;
    let blockchain = this.identity && this.identity.accounts && this.identity.accounts[0] && this.identity.accounts[0].blockchain;
    return meetBridge.invokeSignature({
      // TODO: 客户端应该接收这个参数，如果没有这个参数的话，则默认为当前帐号的公钥
      // TODO: update bridge - publicKey
      publicKey: publicKey,
      data: data,
      // TODO: update bridge - blockchain
      // TODO: 客户端应该接收这个参数，如果没有这个参数的话，则默认为`eos`, 因为未来可能会采用不同的签名方式
      blockchain: blockchain || 'eos',
      whatfor: whatfor,
      isHash: isHash,
      isArbitrary: true
    }).then(function (res) {
      if (res.code === 0) {
        return Promise.resolve(res.data.signature);
      }
      return Promise.reject();
    })
  }

  authenticate(nonce) {
    /**
     * 工作流程：
     *  1. 客户端持有nonce+privateKey进行加密（备注，如果项目方没有提供nonce,默认为网页域名）
     *  2. 客户端返回签名sign
     *  3. 项目方拿到sign，根据publicKey进行解密，验证nonce是否一致
     */
    if (!this.identity) {
      Promise.reject('null');
      return;
    }

    let nonceData = nonce || this.strippedHost();
    let blockchain = this.identity && this.identity.accounts && this.identity.accounts[0] && this.identity.accounts[0].blockchain;
    return meetBridge.invokeSignature({
      // TODO: 客户端应该接收这个参数，如果没有这个参数的话，则默认为当前帐号的公钥
      // TODO: update bridge - publicKey
      publicKey: this.identity.publicKey,
      data: nonceData,
      blockchain: blockchain || 'eos',
      whatfor: '',
      isHash: false,
    }).then(function (res) {
      if (res.code === 0) {
        return Promise.resolve(res.data.signature);
      }
      return Promise.reject();
    });
  }

  signProvider(blockchain) {
    if (blockchain) {
      // scatterSign
      return function (signargs) {
        return meetBridge.invokeSignProvider({
          blockchain: blockchain,
          buf: Array.from(signargs.buf),
          transaction: signargs.transaction.actions
        }).then(function (res) {
          if (res.code === 0) {
            if (signargs.beta3) {
              return {
                // eosjs2
                signatures: [res.data.signature],
                serializedTransaction: Buffer.from(signargs.serializedTransaction, 'hex')
              }
            }
            // eosjs1
            return res.data.signature;
          }
        })
      }
    } else {
      // 兼容旧版逻辑, 旧版的blockchain为空
      return function (signargs) {
        return meetBridge.invokeSignProvider({
          buf: Array.from(signargs.buf),
          transaction: signargs.transaction.actions
        }).then(function (res) {
          // 客户端的实现参考: https://github.com/EOSIO/eosjs/blob/master/src/index.test.js#L327
          if (res.code === 0) {
            return res.data.signature;
          }
          return '';
        }).catch(function (err) {
          return err;
        });
      }
    }
  }

  eos(network, Eos, eosOptions = {}, protocol) {
    if (eosOptions && eosOptions.rpc) {
      //eosjs2的逻辑
      let requiredFields = {};
      // eosjs2 Eos 实例为 Api
      const api = new Eos({ rpc: eosOptions.rpc });
      let signatureProvider = this.hookProvider(network, requiredFields, eosOptions.beta3 || false, api);

      const eos = new Eos(Object.assign(eosOptions, {
        signatureProvider: signatureProvider
      }));

      return eos;
    } else {
      // eosjs1的逻辑
      this.network = Object.assign(this.network, network);
      let blockchain = this.network.blockchain || 'eos';
      if (!network.protocol) {
        network.protocol = protocol || 'http';
      }
      let httpEndpoint = network.protocol + '://' + network.host + ':' + network.port;
      let chainId = network.chainId;
      return Eos(Object.assign(eosOptions, {
        httpEndpoint: httpEndpoint,
        chainId: chainId,
        signProvider: this.signProvider(blockchain)
      }));
    }
  }

  hookProvider(network, requiredFields, beta3, api) {
    var _this = this;
    // Scatter source code here
    // https://github.com/GetScatter/scatter-js/blob/b4155e3ae1fda4af6cabbb4f34c2606387c477e7/packages/plugin-eosjs2/src/index.js#L23
    return {
      requiredFields: {},
      getAvailableKeys: function () {
        if (_this.identity) {
          return [_this.identity.publicKey]
        }
        return [];
      },
      sign: function (signargs) {
        let buffer = Buffer.from(signargs.serializedTransaction, 'hex');
        signargs.serializedTransaction = Buffer.from(signargs.serializedTransaction).toString('hex');
        signargs.transaction = api.deserializeTransaction(buffer);
        signargs.beta3 = beta3;
        signargs.buf = Buffer.concat([
          new Buffer(signargs.chainId, "hex"), // Chain ID
          buffer, // Transaction
          new Buffer(new Uint8Array(32)), // Context free actions
        ]);
        return _this.signProvider('eos')(signargs);
      }
    }
  }
}