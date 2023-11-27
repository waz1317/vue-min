//定义文本模式,作为状态表
const TextModes = {
  DATA: "DATA",
  RCDATA: "RCDATA",
  RAWTEXT: "RAWTEXT",
  CDATA: "CDATA",
};

export function baseParse(str) {
  //定义上下文对象
  const context = {
    //模板内容,用于解析过程消费
    source: str,
    //解析器处于文本模式,起始状态为DATA
    mode: TextModes.DATA,
    //消费指定数量的字符
    advanceBy(num) {
      context.source = context.source.slice(num);
    },
    //消费无用的空白字符
    advanceSpaces() {
      const match = /^[\t\r\n\f ]+/.exec(context.source);
      if (match) {
        context.advanceBy(match[0].length);
      }
    },
  };

  //调用parseChildren函数进行解析
  //第二个参数是由父代节点构成的节点栈,起始为空
  const nodes = parseChildren(context, []);

  return {
    type: "Root",
    children: nodes,
  };
}

function parseChildren(context, ancestors) {
  //存储子节点,作为返回值
  let nodes = [];
  const { mode } = context;

  while (!isEnd(context, ancestors)) {
    let node;
    //只有DATA模式和RCDATA模式才支持插值节点解析
    if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
      //只有DATA模式才支持标签节点解析
      if (mode === TextModes.DATA && context.source[0] === "<") {
        if (context.source[1] === "/") {
          console.error("无效的结束标签");
          continue;
        } else if (/[a-z]/i.test(context.source[1])) {
          node = parseElement(context, ancestors);
        }
      } else if (context.source.startsWith("{{")) {
        //解析插值
        node = parseInterpolation(context);
      }
    }

    //node不存在,说明处于其他模式  非DATA 非RCDATA
    //作为文本处理
    if (!node) {
      node = parseText(context);
    }
    nodes.push(node);
  }

  return nodes;
}

function isEnd(context, ancestors) {
  if (!context.source) return true;
  for (let i = ancestors.length - 1; i >= 0; --i) {
    if (context.source.startsWith(`</${ancestors[i].tag}>`)) return true;
  }
}

function parseElement(context, ancestors) {
  const element = parseTag(context);
  if (element.isSelfClosing) return element;

  context.mode = TextModes.DATA;

  ancestors.push(element);
  element.children = parseChildren(context, ancestors);
  ancestors.pop();
  if (context.source.startsWith(`</${element.tag}>`)) {
    parseTag(context, "end");
  } else console.error("缺少闭合标签");

  return element;
}

function parseTag(context, type = "start") {
  const { advanceBy, advanceSpaces } = context;

  const match =
    type === "start"
      ? /^<([a-z][^\t\r\n\f />]*)/i.exec(context.source)
      : /^<\/([a-z][^\t\r\n\f />]*)/i.exec(context.source);
  const tag = match[1];
  advanceBy(match[0].length);
  advanceSpaces();

  //解析属性与指令
  const props = parseAttributes(context);

  const isSelfClosing = context.source.startsWith(`/>`);
  advanceBy(isSelfClosing ? 2 : 1);
  return {
    type: "Element",
    tag,
    props,
    children: [],
    isSelfClosing,
    v: [],
  };
}

//解析属性
function parseAttributes(context) {
  const { advanceBy, advanceSpaces } = context;
  const props = [];
  while (!context.source.startsWith(">") && !context.source.startsWith("/>")) {
    const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
    const name = match[0];

    //消费属性名称
    advanceBy(name.length);
    //消费属性名称与等于号之间空白字符
    advanceSpaces();
    advanceBy(1);
    advanceSpaces();

    //属性值
    let value = "";

    const quote = context.source[0];
    //判断属性值是否被引号引用
    const isQuoted = quote === `"` || quote === `'`;

    if (isQuoted) {
      //消费引号
      advanceBy(1);
      //获取下一个引号索引
      const endQuoteIndex = context.source.indexOf(quote);
      if (endQuoteIndex > -1) {
        //获取下一个引号之前内容作为属性值
        value = context.source.slice(0, endQuoteIndex);
        //消费属性值
        advanceBy(value.length);
        //消费引号
        advanceBy(1);
      } else console.error("缺少引号");
    } else {
      //代码运行到这里,说明属性值没有被引号引用,到下一个空白符之前内容全部作为属性值
      const match = /^[^\t\r\n\f >]+/.exec(context.source);
      //获取属性值
      value = match[0];
      advanceBy(value.length);
    }
    advanceSpaces();
    props.push({
      type: "Attribute",
      name,
      value,
    });
  }
  return props;
}

//解析文本内容
function parseText(context) {
  //endIndex 为文本结束索引,默认将模板剩余内容作为文本内容
  let endIndex = context.source.length;
  //寻找 <
  const ltIndex = context.source.indexOf("<");
  //寻找{{
  const delimiterIndex = context.source.indexOf("{{");

  //取 ltIndex 和当前endIndex中较小一个为新结尾索引
  if (ltIndex > -1 && ltIndex < endIndex) {
    endIndex = ltIndex;
  }

  //取delimiterIndex 和当前endIndex中较小一个作为新结尾索引
  if (delimiterIndex > -1 && delimiterIndex < endIndex) {
    endIndex = delimiterIndex;
  }

  const content = context.source.slice(0, endIndex);
  context.advanceBy(content.length);
  return {
    type: "Text",
    content,
  };
}

function parseInterpolation(context) {
  context.advanceBy("{{".length);
  const closeIndex = context.source.indexOf("}}");
  if (closeIndex < 0) throw new Error("未闭合");
  const content = context.source.slice(0, closeIndex);
  context.advanceBy(content.length);
  context.advanceBy("}}".length);

  return {
    type: "Interpolation",
    content: {
      type: "Expression",
      content: content,
    },
  };
}
