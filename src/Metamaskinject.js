/*
 * Metamask Shim
 * @Author: John Trump
 * @Date: 2020-06-01 15:31:33
 * @LastEditors: John Trump
 * @LastEditTime: 2020-06-01 18:23:29
 * @FilePath: /src/Metamaskinject.js
 */

import MeetBridge from "../../meet-bridge/dist/meet-bridge.umd";
import 'web3/dist/web3.min.js'

const bridge = new MeetBridge();

export default class MetamaskInject {
  constructor() {
    /*
        向页面注入 Metamask 补丁
     */
    if (typeof window == "object") {
      window.ethereum = this;
    }

    /*
       setup web3
     */
    if (typeof window.web3 !== 'undefined') {
      throw new Error(`Meetone detected another web3.
      Meetone will not work reliably with another web3 extension.
      This usually happens if you have two Meetones installed,
      or Meetone and another web3 extension. Please remove one
      and try again.`)
    }
    const web3 = new Web3(window.ethereum)
    web3.setProvider = function () {
      log.debug('MetaMask - overrode web3.setProvider')
    }
    log.debug('MetaMask - injected web3')

    Object.defineProperty(window.ethereum, '_web3Ref', {
      enumerable: false,
      writable: true,
      configurable: true,
      value: web3.eth,
    });

    /*
        set Metamask properties
     */
    this.wallet = "MEETONE"; // 可以判断 Metamask 的注入逻辑是否来自MEETONE钱包
    /** true if the user has MetaMask installed, false otherwise. */
    this.isMetaMask = true; // 毕竟我们是要模拟 Metamask 环境, 所以我们需要这样写
    /**
     * Deprecated
     *
     * Returns a numeric string representing the current blockchain's network ID. A few example values:
     */
    this.networkVersion = 1; // enum<number> -> '1': Ethereum Main Network
    /**
     * Deprecated
     *
     * Returns a hex-prefixed string representing the current user's selected address, ex: "0xfdea65c8e26263f6d9a1b5de9555d2931a33b825".
     */
    this.selectedAddress = ""; // 当前ETH公钥地址
    this.chainId = "0x1";
  }

  /**
   * Requests the user provides an ethereum address to be identified by. Returns a promise of an array of hex-prefixed ethereum address strings
   *
   * @return Promise<string[]> 当前钱包账号公钥
   */
  async enable() {
    return new Promise((resolve, reject) => {
      try {
        const res = await bridge.customGenerate({
          routeName: 'eth/enable'
        });
        if (res.code !== 0) {
          reject(res.data)
        } else {
          res.code === 0 ? this.selectedAddress = res.data.accounts[0] : null;
          resolve(res.data);
        }
      } catch (error) {
        reject(error);
      }
    })
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
  sendAsync(payload, callback) {
    bridge
      .customGenerate({
        routeName: "eth/sendAsync",
        /*
        Example:
          {
            method: 'eth_sendTransaction',
            params: params,
            from: accounts[0], // Provide the user's account to use.
          }
       */
        params: payload,
      })
      .then(callback());

    new Promise(async (resolve, reject) => {
      bridge
        .customGenerate({
          routeName: "eth/sendAsync",
          /*
          Example:
            {
              method: 'eth_sendTransaction',
              params: params,
              from: accounts[0], // Provide the user's account to use.
            }
         */
          params: payload,
        })
        .then((res) => {
          if (res.code === 0) {
            resolve(res.data);
          }
        });
    });
  }
}
