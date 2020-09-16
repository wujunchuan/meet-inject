/*
 * Entry
 * @Author: JohnTrump
 * @Date: 2019-03-30 18:55:39
 * @Last Modified by: JohnTrump
 * @Last Modified time: 2020-01-20 18:11:07
 */
// 因为使用了async await 语法, rollup打包有这个问题
// ref: https://github.com/rollup/rollup-plugin-babel/issues/209
import "regenerator-runtime/runtime";

import ScatterInject from "./ScatterInject";
import Metamaskinject from "./Metamaskinject";
// import { Troninject } from "./Troninject";

import MeetBridge from "meet-bridge";

const bridge = new MeetBridge();
window.meetBridge = bridge;

export default function main() {
  // 先初始化MEETONE协议桥
  // new ScatterInject(bridge);
  // new Metamaskinject(bridge);
  try {
    new ScatterInject(bridge);
  } catch (error) {
    console.log(error);
  }

  let tryTimes = 0;
  function tryInitMetamaskInject() {
    if (tryTimes >= 100) return;
    if (typeof window.Web3 === "function") {
      try {
        const metamaskInject = new Metamaskinject(bridge);
        metamaskInject.enable();
        /* 主动尝试enable */
      } catch (err) {
        console.log(err);
      }
    } else {
      tryTimes++;
      setTimeout(() => {
        tryInitMetamaskInject();
      }, 100);
    }
  }
  tryInitMetamaskInject();

  // Troninject.init(bridge);

  // 超时时间设定, 因为不能比较好的兼容旧版本,只能在新版本发包前,往已有的JS中注入全局变量 `isSupportMeetoneSdk`来兼容
  window.document.addEventListener("message", (e) => {
    try {
      // @ts-ignore
      const { params, callbackId } = JSON.parse(e.data);
      const resultJSON = decodeURIComponent(atob(params));
      const result = JSON.parse(resultJSON);

      // Will skip new Library ('meet-js-sdk') callback
      // Notice that, we will skip the callback startwith `meetjs_callback`
      // So don't use it if you manually define callbackid
      if (
        callbackId.startsWith("meetjs_callback") ||
        callbackId.startsWith("meet_callback")
      ) {
        return;
      }

      // @ts-ignore
      if (callbackId && typeof window[callbackId] === "function") {
        // @ts-ignore
        window[callbackId](result);
        console.info({ callbackId, result });
        window[callbackId] = null;
      }
    } catch (error) {}
  });
  window.isSupportMeetoneSdk = true;
}

main();
