/*
 * Entry
 * @Author: JohnTrump
 * @Date: 2019-03-30 18:55:39
 * @Last Modified by: JohnTrump
 * @Last Modified time: 2019-11-24 21:30:41
 */
import ScatterInject from "./ScatterInject";

export default function main() {
  // 先初始化MEETONE协议桥
  new ScatterInject();
  // setTimeout(() => {
  // 测试代码
  //   new ScatterInject();
  // }, 100);

  // 超时时间设定, 因为不能比较好的兼容旧版本,只能在新版本发包前,往已有的JS中注入全局变量 `isSupportMeetoneSdk`来兼容
  window.document.addEventListener("message", e => {
    try {
      // @ts-ignore
      const { params, callbackId } = JSON.parse(e.data);
      const resultJSON = decodeURIComponent(atob(params));
      const result = JSON.parse(resultJSON);
      console.info({ callbackId, result });

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
        window[callbackId] = null;
      }
    } catch (error) {}
  });
  window.isSupportMeetoneSdk = true;
}

main();
