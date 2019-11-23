import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import babel from "rollup-plugin-babel";
import { uglify } from "rollup-plugin-uglify";

import pkg from "./package.json";

export default [
  // browser-friendly UMD build
  {
    input: "src/main.js",
    output: {
      name: "meetoneWebviewInject",
      file: pkg.browser,
      format: "iife"
    },
    watch: {
      exclude: "node_modules/**"
    },
    plugins: [
      resolve(), // so Rollup can find `ms`
      commonjs(), // so Rollup can convert `ms` to an ES module
      babel({
        exclude: "node_modules/**"
        // plugins:
        //   process.env.NODE_ENV === "production" ? ["external-helpers"] : []
      }),
      process.env.NODE_ENV === "production" && uglify()
    ]
  }

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  // {
  // input: 'src/main.js',
  // external: ['buffer/'],
  // output: [
  // 	{ file: pkg.main, format: 'cjs' },
  // 	{ file: pkg.module, format: 'es' }
  // ]
  // }
];
