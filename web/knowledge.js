// 讲解按“文件::限定符号”定位，不把项目类与框架同名类混为一谈。
export const files={simple:'agents/simple_agent.py',sdkSimple:'hello_agents/agents/simple_agent.py',
  llm:'hello_agents/core/llm.py',agent:'hello_agents/core/agent.py',registry:'hello_agents/tools/registry.py'};
const node=(id,title,file,symbol,x,y,desc)=>({id,title,file,symbol,x,y,desc,icon:'ƒ',status:'ready',points:[],links:[],input:'见函数签名',output:'见源码与讲解'});
export const extraNodes=[
  node('agent-test','Agent 测试入口','test/test_simple_agent.py','',80,-110,'真实 SimpleAgent · SDK 计算器与流式测试'),
  node('calculator-test','计算器编排测试','test/test_calculator.py','test_with_simple_agent',400,-110,'手动执行工具，再请求模型'),
  {...node('local-registry','项目 ToolRegistry','tools/registry.py','ToolRegistry',1930,355,'本地实现 · 当前只执行函数工具'),status:'partial'},
  {...node('calculator','calculate()','tools/calculator_tool.py','calculate',1930,515,'项目计算器 · 解析 AST 并递归求值'),status:'partial'},
  node('eval-node','_eval_node()','tools/calculator_tool.py','_eval_node',1930,675,'递归处理常量、运算、调用与名称'),
  node('local-tool','项目 Tool','tools/base.py','Tool',1930,210,'工具抽象类与参数描述'),
  node('simple','SimpleAgent.run()',files.simple,'SimpleAgent.run',1040,355,'项目实现 · 普通对话 / 工具分支'),
  node('invoke','LLM.invoke()',files.llm,'HelloAgentsLLM.invoke',1040,515,'框架实现 · 非流式模型调用'),
  node('tool-loop','工具调用循环',files.simple,'SimpleAgent._run_with_tool_calling',1330,515,'项目实现 · 响应、工具、结果回传'),
  node('tool-parse','解析工具标记',files.simple,'SimpleAgent._parse_tool_calls',1330,675,'项目实现 · 正则解析文本协议'),
  node('tool-execute','执行工具调用',files.simple,'SimpleAgent._execute_tool_call',1620,675,'项目实现 · 参数解析与工具调度'),
  node('registry','ToolRegistry',files.registry,'ToolRegistry',1620,355,'框架实现 · 注册、查找与执行'),
  node('sdk-agent','框架 Agent',files.agent,'Agent',1040,210,'实际父类链 · 历史与公共状态'),
  node('stream-run','SimpleAgent.stream_run()',files.simple,'SimpleAgent.stream_run',1040,675,'项目实现 · 流式转发与历史保存'),
];
export const extraRelations=[['simple','sdk-agent','间接继承'],['simple','invoke','无工具时调用'],
  ['agent-test','factory','创建模型'],['agent-test','simple','实例化并运行'],['agent-test','registry','框架注册表'],
  ['calculator-test','factory','创建模型'],['calculator-test','local-registry','创建并执行函数工具'],['calculator-test','client','工具结果交给 think'],
  ['local-registry','calculator','注册并调度 calculate'],['calculator','eval-node','递归求值'],['local-registry','local-tool','对象表保存的类型'],
  ['simple','tool-loop','启用工具时调用'],['simple','registry','持有工具注册表'],
  ['tool-loop','invoke','迭代调用'],['tool-loop','tool-parse','解析响应'],
  ['tool-loop','tool-execute','执行标记'],['tool-execute','registry','查找 / 执行工具'],
  ['stream-run','client','调用 stream_invoke']];

// 以下为现有方法的教学模拟，不代表 main.py 已经接入或实际运行通过。
export const flowExamples={
  simple:[
    {node:'simple',title:'01 / 组织上下文',text:'方法级模拟：系统提示词、历史、当前输入依次加入 messages。',data:'system → history → user'},
    {node:'sdk-agent',title:'02 / 读取框架历史',text:'get_history() 来自安装包 Agent，不是项目 core/agent.py。',data:'self.get_history() → list[Message]'},
    {node:'invoke',title:'03 / 非流式调用',text:'无工具分支使用 invoke()，等待完整回答。这里不会实际发送请求。',data:'answer = self.llm.invoke(messages, **kwargs)'},
    {node:'sdk-agent',title:'04 / 保存问答',text:'使用框架 Message，调用继承的 add_message() 两次。',data:'user + assistant → _history'},
    {node:'simple',title:'05 / 返回结果',text:'方法级模拟结束；当前 main.py 仍走 think()，未调用此 Agent。',data:'return response'},
  ],
  tools:[
    {node:'simple',title:'01 / 进入工具分支',text:'方法级模拟前提：传入工具注册表并开启工具调用。',data:'enable_tool_calling = True'},
    {node:'tool-loop',title:'02 / 请求并迭代',text:'进入 _run_with_tool_calling，维护本轮 messages。',data:'while current_iteration < max_tool_iterations'},
    {node:'invoke',title:'03 / 模拟模型标记',text:'假设模型返回一个计算器文本标记。此数据是教学示例。',data:'[TOOL_CALL:calculator:1+1]'},
    {node:'tool-parse',title:'04 / 解析标记',text:'从响应提取工具名、参数和原标记。',data:'{tool_name: calculator, parameters: 1+1}'},
    {node:'tool-execute',title:'05 / 调度执行',text:'计算器走 registry.execute_tool；其他工具走参数字典和 tool.run。',data:'_execute_tool_call("calculator", "1+1")'},
    {node:'registry',title:'06 / 模拟工具结果',text:'假设已注册的计算器返回 2；并不实际执行工具。',data:'示例结果：2'},
    {node:'tool-loop',title:'07 / 回传观察',text:'结果作为 user 消息插回本轮上下文，继续请求模型。',data:'messages.append({role: user, content: 工具执行结果…})'},
    {node:'invoke',title:'08 / 最终回答',text:'假设下一轮没有工具标记，作为最终回答返回。',data:'示例回答：1+1=2'},
    {node:'simple',title:'09 / 记录与返回',text:'仅原始输入和最终回答写入历史，不保存中间工具消息。',data:'add_message(user); add_message(assistant)'},
  ],
};

const step=(title,text,needle,end)=>({title,text,needle,end});
export const notes={
  'core/llm.py::create_llm':{summary:'读取同一服务的一组连接配置，并全部显式传入 HelloAgentsLLM。',input:'provider?, model?, config_path?',output:'HelloAgentsLLM 实例',points:['参数 provider / model 优先，否则取 JSON 默认值。','load_dotenv 不覆盖进程中已有环境变量。','当前只显式检查空密钥；缺失 JSON 键和环境变量按 Python 原有规则报错。'],steps:[step('加载配置','从项目根目录加载 .env，解析指定 JSON 或 models.json。','load_dotenv','config ='),step('选择服务','从同一 providers 项读取模型和地址。','provider =','base_url ='),step('读取凭证','云端用 apiKeyEnv，本地用 apiKey。','if "apiKeyEnv"','api_key = settings'),step('检查并创建','空密钥报错，显式传入整组参数。','if not api_key:','api_key=api_key')]},
  'tools/base.py::Tool':{summary:'项目工具抽象类：统一名称、描述、参数声明与 run 字典接口。',input:'name, description',output:'具体工具子类',points:['run 和 get_parameters 要求子类实现。','当前 SimpleAgent 使用框架工具类型；此项目类尚未接入该继承链。']},
  'tools/registry.py::ToolRegistry':{summary:'项目本地注册表，分别保存对象工具和函数工具。',input:'Tool 对象或函数',output:'描述文本与函数执行结果',warning:'当前 execute_tool 只查询 _functions；to_openai_schema 依赖本类未定义的 get_parameters/name/description，不应视为已完成的原生工具调用接口。',points:['与安装包 hello_agents.tools.registry.ToolRegistry 不是同一个类。','计算器编排测试使用本类；SimpleAgent 测试使用框架注册表。']},
  'tools/registry.py::ToolRegistry.execute_tool':{summary:'只在函数表中查找名称，再把原始参数字符串交给保存的 func。',input:'name, parameters: str',output:'函数结果或工具不存在文本',points:['不会查询 _tools，也不捕获被调用函数抛出的异常。'],steps:[step('检查名称','未注册时直接返回错误文本。','if name not in','return f'),step('取函数并执行','注册名和 Python 函数名可以不同。','func =','return func(parameters)')]},
  'tools/calculator_tool.py::calculate':{summary:'把表达式解析成 AST，交给 _eval_node 求值，最后返回字符串。',input:'expression: str',output:'结果字符串或指定异常的错误文本',warning:'当前未实现 UnaryOp 求值；未知节点可能隐式返回 None。异常处理只覆盖源码列出的几种类型。',points:['使用 ast.parse，不调用内置 eval。','函数和常量白名单为 sqrt / pi。'],steps:[step('检查与白名单','先处理空输入，再创建运算表和名称表。','if not expression.strip():','try:'),step('解析并计算','node.body 是表达式主体，递归计算后转换为字符串。','node = ast.parse','return str(result)'),step('错误转文本','只捕获列出的异常，不保证捕获所有错误。','except (SyntaxError','return f')]},
  'tools/calculator_tool.py::_eval_node':{summary:'按节点类型递归计算。BinOp 先计算左右子节点，Call 先计算参数。',input:'AST 节点、运算表、函数表',output:'节点值，未匹配时可能为 None',points:['Constant 返回 value；Name 从白名单取常量。','递归调用可以沿源码链接继续查看。','运算表包含正负号不等于已经实现 UnaryOp 分支。']},
  'tools/calculator_tool.py::create_calculator_registry':{summary:'创建项目注册表，把注册名 my_calculator 绑定到函数 calculate。',input:'无',output:'本地 ToolRegistry',points:['注册名是调度入口；calculate 是真正执行的函数。','不创建模型客户端，也不发送请求。']},
  'test/test_calculator.py::test_with_simple_agent':{summary:'测试代码手动指定表达式、执行计算器，再调用 think 让模型组织回答。',input:'测试内预设问题和表达式',output:'终端模型回答',points:['虽然函数名含 simple_agent，实际没有实例化 SimpleAgent。','think 自身打印，外层再次 print(chunk) 可能重复显示。','这条路径使用本地注册表和 my_calculator。']},
  'test/test_simple_agent.py::':{summary:'实际创建自定义 SimpleAgent，测试普通对话、框架计算器、流式回答和历史。',input:'create_llm 创建的客户端与 SDK 工具',output:'终端响应及历史消息',points:['ToolRegistry 和 CalculatorTool 都来自 hello_agents 安装包。','SDK 计算器的注册名称是 python_calculator；与本地 my_calculator 区分。','这些测试包含真实模型请求，本页面只展示源码，不执行测试。']},
  [`${files.sdkSimple}::SimpleAgent.__init__`]:{summary:'框架 SimpleAgent 的构造函数没有额外状态，只把名称、模型、提示词和配置转交给框架 Agent。',input:'name, llm, system_prompt?, config?',output:'初始化后的框架 Agent 状态',points:['这是项目 super().__init__ 的直接调用目标。','继续点击该函数里的 super().__init__，会进入框架 core/agent.py。'],steps:[step('初始化公共状态','调用框架 Agent.__init__，不是本地同名类。','super().__init__')]},
  [`${files.agent}::Agent.__init__`]:{summary:'框架 Agent 保存名称、模型客户端、系统提示词、配置，并为每个实例建立独立的历史列表。',input:'name, llm, system_prompt?, config?',output:'name / llm / system_prompt / config / _history',points:['config 未传入时创建框架 Config，不读取项目 Config。','llm 由外部传入，Agent 不重新创建连接。'],steps:[step('保存公共依赖','模型客户端和提示词直接保留为属性。','self.name =','self.system_prompt ='),step('配置与历史','使用框架 Config 默认值，并初始化独立列表。','self.config =','self._history:')]},
  [`${files.simple}::SimpleAgent.run`]:{
    summary:'自定义 Agent 的同步执行入口。先组织系统提示词、历史与当前输入，再按工具开关走普通对话或工具循环。main.py 目前尚未调用它。',
    input:'input_text, max_tool_iterations=3, **kwargs',output:'最终回答 str',
    points:['父类是安装包的 SimpleAgent，不是项目 core/agent.py。','Message、Config、ToolRegistry 也从安装包导入。','只有模型返回后才把用户消息和最终回答加入历史。'],
    steps:[step('组织系统提示词','工具开启时提示词加入可用工具和文本调用协议。','enhanced_system_prompt =','messages.append({"role": "system"'),
      step('读取历史并追加输入','get_history() 来自框架 Agent；此处没有调用项目 Message.to_dict()。','for msg in self.get_history():','messages.append({"role": "user"'),
      step('普通对话调用 invoke','将 kwargs 透传给模型客户端。点击右侧 self.llm.invoke 可进入框架实现。','if not self.enable_tool_calling:','return response'),
      step('进入工具循环','只在 enable_tool_calling 为真时执行该分支。','return self._run_with_tool_calling')],
  },
  [`${files.simple}::SimpleAgent.__init__`]:{
    summary:'先让框架父类初始化公共状态，再保存工具注册表和工具开关。',input:'name, llm, system_prompt?, config?, tool_registry?',output:'自定义 Agent 实例',
    points:['传入注册表且 enable_tool_calling 为真时才启用工具。','super().__init__ 指向框架 SimpleAgent.__init__，它再调用框架 Agent.__init__。'],
    steps:[step('初始化框架父类','点击 super().__init__ 沿继承链查看。','super().__init__'),step('设置工具开关','注册表为空时，即使传 True 也会禁用工具。','self.tool_registry =','self.enable_tool_calling =')],
  },
  [`${files.simple}::SimpleAgent._get_enhanced_system_prompt`]:{
    summary:'在基础系统提示词后追加工具描述和 [TOOL_CALL:名称:参数] 协议；没有工具时直接返回基础提示词。',
    input:'system_prompt 与 tool_registry',output:'系统提示词 str',points:['这是提示词驱动的文本协议，不是原生 API tool_calls。'],
    steps:[step('选择基础提示词','没有自定义提示词时使用默认助手提示。','base_prompt =','return base_prompt'),step('读取工具描述','调用框架注册表的 get_tools_description()。','tools_description =','return base_prompt'),step('拼接调用格式','工具调用要求模型按约定输出文本标记。','tools_section =','return base_prompt + tools_section')],
  },
  [`${files.simple}::SimpleAgent._run_with_tool_calling`]:{
    summary:'循环请求模型、解析工具标记、执行工具，并把结果作为 user 消息回传。没有工具标记时将响应视为最终回答。',
    input:'messages, input_text, max_tool_iterations, **kwargs',output:'最终回答 str',
    points:['工具结果是 user 消息，并非 role=tool 的原生工具调用。','达到循环上限后还会额外调用一次 invoke()；该次结果不再解析工具标记。','只把原用户输入和最终回答写入长期历史，中间工具消息仅保留在本轮 messages。'],
    steps:[step('请求并解析','先调用 invoke，再使用正则识别文本工具标记。','while current_iteration','tool_calls ='),step('执行每个工具','收集结果，并移除 assistant 文本中的原始标记。','for call in tool_calls:','clean_response = clean_response.replace'),step('回传结果继续循环','工具结果追加为 user 消息，供下一轮模型参考。','messages.append({"role" : "assistant"','continue'),step('确定最终回答','无标记时结束；耗尽迭代预算后补一次模型调用。','final_response = response','final_response = self.llm.invoke'),step('写入历史','记录原始输入和最终回答。','self.add_message(Message(input_text','return final_response')],
  },
  [`${files.simple}::SimpleAgent._parse_tool_calls`]:{
    summary:'用正则提取 [TOOL_CALL:工具名:参数]，返回工具名称、参数字符串和原始标记。',input:'模型响应 text',output:'list[dict]',
    points:['没有匹配时返回空列表。','工具名与参数会 strip()，original 保留匹配原文。','这种协议不支持任意嵌套结构，参数中的右方括号会结束匹配。'],
    steps:[step('正则匹配','提取名称和参数两个捕获组。','pattern =','matches ='),step('整理结构','保留 original 供调用方清理响应文本。','tool_calls =','return tool_calls')],
  },
  [`${files.simple}::SimpleAgent._execute_tool_call`]:{
    summary:'calculator 通过注册表执行；其他工具先解析参数、查找工具，再调用该对象的 run()。异常被转成文本交给后续模型处理。',
    input:'tool_name, parameters 字符串',output:'执行结果或错误说明 str',
    points:['get_tool() 只查找 Tool 对象，不查找函数工具。','具体 tool.run() 的实现由运行时注册的对象决定，索引不凭同名函数猜测。'],
    steps:[step('检查工具注册表','未配置时返回错误文本。','if not self.tool_registry:','return f'),step('计算器分支','execute_tool() 是框架注册表的真实实现，可点击进入。','if tool_name == "calculator":','result = self.tool_registry.execute_tool'),step('其他工具分支','解析字符串，查找对象，调用动态工具。','param_dict =','result = tool.run'),step('结果与异常','不重新抛出工具异常，转成结果字符串。','return f"✅','return f"❌ 工具调用失败')],
  },
  [`${files.simple}::SimpleAgent._parse_tool_parameters`]:{
    summary:'将参数字符串转成字典：优先解析 key=value；否则按 search、memory 或通用工具推断字段。',input:'tool_name, parameters',output:'dict[str, str]',
    points:['limit=3 解析后仍是字符串，不自动转为整数。','逗号分割不支持转义和嵌套结构。'],
    steps:[step('键值对形式','按逗号拆项，再按第一个等号分割键值。',"if '=' in parameters:", 'else:'),step('直接文本形式','search → query，memory → action/search+query，其余 → input。','if tool_name == "search":','return param_dict')],
  },
  [`${files.llm}::HelloAgentsLLM.invoke`]:{
    summary:'非流式模型调用：把模型、消息和本次参数交给 OpenAI 兼容客户端，等待完整响应并提取第一项 choice 的文本。',
    input:'messages: list[dict], **kwargs',output:'response.choices[0].message.content',
    points:['temperature、max_tokens 的本次传入值优先于实例默认值。','其余 kwargs 被透传给底层客户端。构造函数保存的 self.kwargs 不会在这里自动展开。','底层 chat.completions.create 属于 OpenAI SDK，此版只展示其调用边界，不伪造 SDK 实现。'],
    steps:[step('发送非流式请求','model 和 messages 显式传入；底层 SDK 负责 HTTP 请求。','response = self._client.chat.completions.create(','            )'),step('覆盖并透传参数','提取两个常用参数，过滤同名键后展开其他 kwargs。',"temperature=kwargs.get",'**{k: v'),step('提取最终文本','返回第一项 choice 的 message.content；本方法不打印回答。','return response.choices[0].message.content'),step('包装异常','底层异常统一包装成 HelloAgentsException。','except Exception as e:','raise HelloAgentsException')],
  },
  [`${files.llm}::HelloAgentsLLM.think`]:{
    summary:'流式请求接口。遍历生成器时才调用 API；每个文本片段先打印，再 yield 给调用方。',input:'messages, temperature?',output:'Iterator[str]',points:['当前 main.py 直接使用该路径，并未经过 SimpleAgent。','调用前的表情打印在 try 外，编码错误不会在这里被包装。'],
    steps:[step('发送流式请求','stream=True，按片段接收响应。','response =','stream=True'),step('提取并产出文本','空文本跳过；打印后 yield。','for chunk in response:','yield content'),step('包装异常','捕获请求或遍历过程中的错误。','except Exception as e:','raise HelloAgentsException')],
  },
  [`${files.llm}::HelloAgentsLLM.stream_invoke`]:{
    summary:'流式兼容入口，使用 yield from 转发 think() 的文本片段。',input:'messages, **kwargs',output:'Iterator[str]',points:['只提取 temperature，其他 kwargs 没有继续透传。'],steps:[step('委托给 think','点击 self.think 查看真实流式请求。','temperature =','yield from')],
  },
  [`${files.agent}::Agent.get_history`]:{summary:'返回历史消息列表的浅拷贝，防止调用方增删原列表。',input:'无',output:'list[Message]',points:['列表容器独立，内部消息对象仍共享。','这是自定义 SimpleAgent 实际继承的方法，不是项目 core/agent.py 的同名实现。'],steps:[step('浅拷贝历史','copy() 不复制每条 Message 对象。','return self._history.copy()')]},
  [`${files.agent}::Agent.add_message`]:{summary:'将消息对象追加到当前 Agent 的历史列表。',input:'message: Message',output:'None',points:['本方法不限制历史长度。','SimpleAgent 在获得回答后主动调用两次，分别保存用户消息和回答。'],steps:[step('追加消息','直接修改当前实例的 _history 列表。','self._history.append')]},
  [`${files.simple}::SimpleAgent.stream_run`]:{
    summary:'组织上下文、转发模型片段、累积回答，并在生成器完整结束后保存历史。',input:'input_text, **kwargs',output:'Iterator[str]',
    points:['必须完整消费生成器，末尾保存历史的语句才会执行。','该路径没有调用增强工具提示词或工具循环。'],
    steps:[step('读取历史','通过框架 get_history() 获取消息。','for msg in self.get_history():'),step('转发流式片段','累积完整回答并逐块 yield 给调用方。','for chunk in self.llm.stream_invoke','yield chunk'),step('保存完整回答','生成器完整结束后保存用户消息和累积回答。','self.add_message(Message(input_text','self.add_message(Message(full_response')],
  },
  [`${files.simple}::SimpleAgent.remove_tool`]:{summary:'尝试注销指定工具。当前调用的方法名与安装的注册表不匹配。',warning:'当前 ToolRegistry 提供 unregister(name)，没有 unregister_tool(name)。传入注册表时此方法会因属性不存在而失败。',input:'tool_name',output:'bool（存在接口不匹配）',points:['可通过下方关联查看框架 unregister 的实际实现。']},
  [`${files.registry}::ToolRegistry.execute_tool`]:{summary:'优先查找 Tool 对象，调用 run({input: 原字符串})；否则查找函数工具并调用。',input:'name, input_text',output:'工具结果或错误文本',points:['与项目 _execute_tool_call() 的非计算器分支不同：后者直接调用 tool.run(param_dict)。','注册表内部也会把异常转成错误字符串。'],steps:[step('对象工具','将字符串包装到 input 字段，交给 Tool.run。','if name in self._tools:','except Exception'),step('函数工具','按名称查找并调用注册的函数。','elif name in self._functions:','return func(input_text)'),step('未找到工具','返回错误说明。','return f"错误：未找到')]},
};
