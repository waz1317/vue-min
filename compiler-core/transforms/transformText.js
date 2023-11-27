export function transformText(node) {
  //判断是否为文本或者插值节点
  function isText(node) {
    return node.type === "Text" || node.type === "Interpolation";
  }

  if (node.type === "Element") {
    return () => {
      const { children } = node;
      let currentContainer;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        //搜索子节点 ,如果为插值或者文本节点即再搜索下一位,看是不是文本插值节点,如果是,则创建复合节点
        if (isText(child)) {
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j];
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = {
                  type: "Compound_Expression",
                  children: [child],
                };
              }
              currentContainer.children.push(" + ");
              currentContainer.children.push(next);
              children.splice(j, 1);
              j--;
            } else {
              currentContainer = undefined;
              break;
            }
          }
        }
      }
    };
  }
}
