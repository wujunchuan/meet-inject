import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import babel from "rollup-plugin-babel";
// import { uglify } from "rollup-plugin-uglify";
import json from 'rollup-plugin-json';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';

/* 此依赖需要特殊处理一下, ref: https://github.com/rollup/rollup-plugin-commonjs/issues/403#issuecomment-519696236 */
import ethUtil from 'ethereumjs-util';

import pkg from "./package.json";

export default [
  // browser-friendly UMD build
  {
    input: "src/main.js",
    output: {
      name: "meetoneWebviewInject",
      file: pkg.browser,
      format: "iife",
      intro: 'var global = typeof self !== undefined ? self : this;'
    },
    watch: {
      exclude: "node_modules/**"
    },
    plugins: [
      resolve({
        browser: true,  // Default: false
      }), // so Rollup can find `ms`
      commonjs({
        include: ['node_modules/**'],
        namedExports: {
          // 'ethereumjs-util': ['bufferToHex']
          'ethereumjs-util': Object.keys(ethUtil)
        }
      }), // so Rollup can convert `ms` to an ES module
      json(),
      babel({
        exclude: "node_modules/**"
        // plugins:
        //   process.env.NODE_ENV === "production" ? ["external-helpers"] : []
      }),
      globals(),
      builtins(),
      // process.env.NODE_ENV === "production" && uglify()
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
