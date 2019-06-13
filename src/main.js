/*
 * Entry
 * @Author: JohnTrump
 * @Date: 2019-03-30 18:55:39
 * @Last Modified by: JohnTrump
 * @Last Modified time: 2019-06-13 11:56:15
 */
import ScatterInject from "./ScatterInject";
import MeetBridge from "meet-bridge";

export default function main() {
  // 先初始化MEETONE协议桥
  window.meetBridge = new MeetBridge();
  // 在注入Scatter Shim相关的代码逻辑
  new ScatterInject();
}

main();
