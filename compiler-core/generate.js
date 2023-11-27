export function generate(ast) {
  const context = createCodegenContext();
  const { push } = context;

  //生成前导码
  //例 const { toDisplayString:_toDisplayString } = Vue \n
  genFunctionPreamble(ast, context);

  push("return ");
  const functionName = "render";
  const args = ["_ctx", "_cache"];
  const signature = args.join(", ");

  push(`function ${functionName}(${signature}){`);
  push(`return `);
  genNode(ast.codegenNode, context);
  push("}");

  return {
    code: context.code,
  };
}

//生成前导码
//例 const { toDisplayString:_toDisplayString } = Vue \n
function genFunctionPreamble(ast, context) {
  const { push } = context;
  const VueBinging = "Vue";
  const aliasHelper = (s) => `${s}:_${s}`;
  if (ast.helpers.length > 0) {
    push(
      `const { ${ast.helpers.map(aliasHelper).join(", ")} } = ${VueBinging}`
    );
    push("\n");
  }
}

function createCodegenContext() {
  const context = {
    code: "",
    push(source) {
      context.code += source;
    },
    forValueKey: [],
  };

  return context;
}

function genNode(node, context) {
  switch (node.type) {
    case "Text":
      genText(node, context);

      break;
    case "Interpolation":
      genInterpolation(node, context);
      break;
    case "Expression":
      genExpression(node, context);
      break;
    case "Element":
      genElement(node, context);
      break;
    case "Compound_Expression":
      genCompoundExpression(node, context);
      break;
  }
}

//处理文本节点
function genText(node, context) {
  const { push } = context;
  push(`'${node.content}'`);
}

//处理插值节点
function genInterpolation(node, context) {
  const { push } = context;
  push(`_toDisplayString(`);
  genNode(node.content, context);
  push(")");
}

//处理插值表达式
function genExpression(node, context) {
  const { push } = context;
  const content =
    node.content.includes(context.forValueKey[0]) ||
    node.content.includes(context.forValueKey[1])
      ? node.content.slice(5, node.content.length)
      : node.content;
  push(content);
}

function genElement(node, context) {
  const { push } = context;
  const { tag, children, props, v } = node;
  //假设现在一个节点只有一个指令
  if (v.length >= 1) {
    const instruct = v[0];
    if (instruct.name === "v-if") {
      if (instruct.value === "true" || instruct.value === "false")
        push(`${instruct.value}?`);
      else push(`_ctx.${instruct.value}?`);
      addElement(node, context);
      push(`:_createCommentVNode("v-if")`);
    } else if (instruct.name === "v-for") {
      const forValue = instruct.value.split(" ");

      push(
        `_createElementVNode("Fragment",null,_renderList(_ctx.${
          forValue[forValue.length - 1]
        }, ${forValue[0]}=>{ return `
      );
      const forValueKey = forValue[0]
        .slice(1, forValue[0].length - 1)
        .split(",");
      context.forValueKey = forValueKey;
      addElement(node, context);
      push("}))");
      context.forValueKey = [];
    } else addElement(node, context);
  } else addElement(node, context);
}
//添加Element
function addElement(node, context) {
  const { push } = context;
  const { tag, children, props } = node;

  push(`_createElementVNode(`);
  genNodeList(genNullable([tag, props, children]), context);
  if (isElements(children)) genElementList(children, context);
  push(")");
}

//处理假值
function genNullable(args) {
  return args.map((arg) => arg || "null");
}

function genNodeList(nodes, context) {
  const { push } = context;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (typeof node === "string") push(node);
    else {
      genNode(node, context);
    }
    if (i < nodes.length - 1) push(", ");
  }
}

function isElements(nodes) {
  let num = 0;
  if (nodes) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].type === "Element") num++;
      if (num >= 1) return true;
    }
  }
  return false;
}

//处理多个标签节点
function genElementList(nodes, context) {
  const { push } = context;
  push("[");
  for (let i = 0; i < nodes.length; i++) {
    genNode(nodes[i].codegenNode, context);
    if (i < nodes.length - 1) push(", ");
  }
  push("]");
}

//处理复合节点
function genCompoundExpression(node, context) {
  const { push } = context;
  const { children } = node;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (typeof child === "string") {
      push(child);
    } else {
      genNode(child, context);
    }
  }
}
