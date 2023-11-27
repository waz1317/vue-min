export function transformExpression(node) {
  if (node.type === "Interpolation") {
    node.content = processExpression(node.content);
  }
}

function processExpression(node) {
  node.content = `_ctx.${node.content}`;
  return node;
}
