/*
 * Entry
 * @Author: JohnTrump
 * @Date: 2019-03-30 18:55:39
 * @Last Modified by: JohnTrump
 * @Last Modified time: 2019-11-22 17:20:15
 */
import ScatterInject from "./ScatterInject";
import MeetBridge from "meet-bridge";

export default function main() {
  // 先初始化MEETONE协议桥
  window.meetBridge = new MeetBridge();
  new ScatterInject(); // 正式环境请恢复注释
  // TODO: 此乃测试代码
  // setTimeout(() => {
  //   // 在注入Scatter Shim相关的代码逻辑
  //   let meetone_inject = new ScatterInject();
  //   window.meetone_inject = meetone_inject;
  // }, 1000);
  // 超时时间设定, 因为不能比较好的兼容旧版本,只能在新版本发包前,往已有的JS中注入全局变量 `isSupportMeetoneSdk`来兼容
  window.isSupportMeetoneSdk = true;
}

main();
