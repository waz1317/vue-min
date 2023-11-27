export function transformElement(node, context) {
  if (node.type === "Element") {
    return () => {
      let vnodeChildren;
      if (isElements(node.children)) {
        vnodeChildren = node.children;
      } else {
        vnodeChildren = node.children[0];
      }
      context.helper("createElementVNode");

      //tag
      const vnodeTag = `'${node.tag}'`;
      //props
      let vnodeProps = "";
      if (node.props.length > 0)
        vnodeProps = transformProps(node.props, node.v, context, node);
      const vnodeElement = {
        type: "Element",
        tag: vnodeTag,
        props: vnodeProps,
        children: vnodeChildren,
        v: node.v,
      };

      node.codegenNode = vnodeElement;
    };
  }
}

//判断是否含有多个Element子节点
function isElements(nodes) {
  let num = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].type === "Element") num++;
    if (num >= 1) return true;
  }
  return false;
}

//处理子节点中含有vif节点

//解析属性
function transformProps(props, v, context, node) {
  let propsString = "";
  propsString += "{";
  //先循环,将v-指令加入node.v中,再从数组去除
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    const name = prop.name;
    if (name.includes("v-")) {
      if (name === "v-if") {
        context.helper("createCommentVNode");
        props.push({ type: "Attribute", name: "key", value: node.ifKey });
      }
      if (name === "v-for") {
        context.helper("renderList");
      }
      if (name === "v-model") {
        props.push({
          name: "modelInput",
          value: `${prop.value}`,
        });
      }
      v.push({ name, value: prop.value });
      props.splice(i, 1);
    }
  }
  //再统一处理指令
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    const name = prop.name;
    if (name.includes("@")) {
      propsString +=
        "on" + name.replace(/@(\w)/g, (match, p1) => p1.toUpperCase());
      console.log(prop.value);
      if (prop.value.includes("(") && prop.value.includes(")")) {
        propsString += `:()=>_ctx.${prop.value}`;
      } else propsString += `:_ctx.${prop.value}`;
    } else if (name === ":key") {
      propsString += name.replace(":", " ");
      propsString += `:${prop.value}`;
    } else if (name.includes(":")) {
      propsString += name.replace(":", " ");
      propsString += `:_ctx.${prop.value}`;
    } else {
      propsString += name;
      propsString += `:"${prop.value}"`;
    }
    if (i < props.length - 1) propsString += ", ";
  }

  propsString += "}";
  return propsString;
}

//ctx
