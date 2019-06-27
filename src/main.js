/*
 * Entry
 * @Author: JohnTrump
 * @Date: 2019-03-30 18:55:39
 * @Last Modified by: JohnTrump
 * @Last Modified time: 2019-06-27 10:47:49
 */
import ScatterInject from "./ScatterInject";
import MeetBridge from "meet-bridge";

export default function main() {
  // 先初始化MEETONE协议桥
  window.meetBridge = new MeetBridge();
  // 在注入Scatter Shim相关的代码逻辑
  new ScatterInject();
  // 超时时间设定, 因为不能比较好的兼容旧版本,只能在新版本发包前,往已有的JS中注入全局变量 `isSupportMeetoneSdk`来兼容
  window.isSupportMeetoneSdk = true;
}

main();
