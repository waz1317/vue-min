export function transform(root, options = {}) {
  const context = createTransformContext(root, options);
  //1遍历   深度优先搜索
  traverseNode(root, context);

  createRootCodegen(root);

  root.helpers = [...context.helpers.keys()];
}

function createRootCodegen(root) {
  const child = root.children[0];
  if (child.type === "Element") {
    root.codegenNode = child.codegenNode;
  } else {
    root.codegenNode = root.children[0];
  }
}
//创建全局上下文,
function createTransformContext(root, options) {
  const context = {
    root,
    nodeTransforms: options.nodeTransforms || [],
    helpers: new Map(),
    helper(key) {
      context.helpers.set(key, 1);
    },
  };

  return context;
}

//递归访问节点
function traverseNode(node, context) {
  const nodeTransforms = context.nodeTransforms;
  const exitFns = [];
  for (let i = 0; i < nodeTransforms.length; i++) {
    const transform = nodeTransforms[i];
    const onExit = transform(node, context);
    if (onExit) exitFns.push(onExit);
  }

  switch (node.type) {
    case "Interpolation":
      context.helper("toDisplayString");
      break;
    case "Root":
    case "Element":
      traverseChildren(node, context);
      break;
  }

  let i = exitFns.length;
  while (i--) exitFns[i]();
}

//遍历子节点
//处理children
function traverseChildren(node, context) {
  const children = node.children;
  let ifIndex = 0;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    node.ifKey = ifIndex++;
    traverseNode(child, context);
  }
}

function aa() {
  return _createElementBlock(
    "p",
    {
      key: item,
      class: "ss",
    },
    _toDisplayString(index)
  );
}
