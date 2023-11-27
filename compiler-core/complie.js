import { baseParse } from "./parse.js";
import { transform } from "./transform.js";
import { generate } from "./generate.js";
import { transformExpression } from "./transforms/transformExpression.js";
import { transformElement } from "./transforms/transformElement.js";
import { transformText } from "./transforms/transformText.js";

export function baseComplie(template) {
  const ast = baseParse(template);
  transform(ast, {
    nodeTransforms: [transformExpression, transformElement, transformText],
  });

  return generate(ast);
}

// function aa() {
//   const {
//     toDisplayString: _toDisplayString,
//     createElementVNode: _createElementVNode,
//     createCommentVNode: _createCommentVNode,
//   } = Vue;
//   return function render(_ctx, _cache) {
//     return _createElementVNode("div", null, [
//       _ctx.dd
//         ? _createElementVNode(
//             "p",
//             { class: "test" },
//             _toDisplayString(_ctx.dsa)
//           )
//         : _createCommentVNode("v-if"),
//     ]);
//   };
// }

// function aa() {
//   _createElementVNode(
//     _Fragment,
//     null,
//     _renderList(_ctx.aa, (item, index) => {
//       return _openBlock(), _createElementBlock("p", { key: item }, "dsds");
//     })
//   );
// }
