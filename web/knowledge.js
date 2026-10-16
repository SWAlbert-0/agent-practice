// 教学说明使用 文件::限定符号 定位，源码与行号由静态索引生成。
export const files={simple:'agents/simple_agent.py',react:'agents/react_agent.py',
  llm:'core/llm.py',agent:'core/agent.py',registry:'tools/registry.py'};
const node=(id,title,file,symbol,x,y,desc,status='ready')=>({id,title,file,symbol,x,y,desc,status,icon:'ƒ',points:[],links:[]});
export const nodes=[
  node('main','main.py','main.py','',80,40,'入口 · 直接消费 LLM.think'),
  node('agent-test','SimpleAgent 示例','examples/simple_agent_demo.py','',380,40,'本地 Agent、注册表与计算器'),
  node('react-test','ReAct 离线测试','tests/test_react_agent.py','test_calculator_result_reaches_next_model_request',680,40,'FakeLLM 验证行动、观察与最终答案'),
  node('calculator-test','计算器编排示例','examples/calculator_demo.py','demo_calculator_with_llm',980,40,'手动调用工具，再让模型回答'),
  node('factory','create_llm()',files.llm,'create_llm',80,210,'读取同组连接配置，返回本地 LLM'),
  node('client','LLM.think()',files.llm,'LLM.think',380,210,'流式请求 · 打印并 yield 文本'),
  node('invoke','LLM.invoke()',files.llm,'LLM.invoke',680,210,'非流式调用 · 返回完整文本'),
  node('request','LLM._request()',files.llm,'LLM._request',980,210,'合并选项，进入 OpenAI SDK 边界'),
  node('agent','Agent 基类',files.agent,'Agent.__init__',80,400,'本地公共状态与依赖注入'),
  node('simple','SimpleAgent.run()',files.simple,'SimpleAgent.run',380,400,'普通对话或文本工具循环'),
  node('react','ReActAgent.run()',files.react,'ReActAgent.run',680,400,'Thought / Action / Observation 循环'),
  node('plan','PlanAndSolveAgent','agents/plan_solve_agent.py','PlanAndSolveAgent.run',980,400,'规划列表，再按步骤请求模型'),
  node('reflection','ReflectionAgent','agents/reflection_agent.py','ReflectionAgent.run',1280,400,'初答、反思与改进'),
  node('stream-run','SimpleAgent.stream_run()',files.simple,'SimpleAgent.stream_run',380,570,'转发流式回答，结束后保存历史'),
  node('tool-loop','SimpleAgent 工具循环',files.simple,'SimpleAgent._run_with_tool_calling',680,570,'解析标记、执行并回传结果'),
  node('tool-parse','解析工具标记',files.simple,'SimpleAgent._parse_tool_calls',980,570,'正则提取名称、参数和原标记'),
  node('tool-execute','执行工具调用',files.simple,'SimpleAgent._execute_tool_call',1280,570,'注册表入口或对象 run'),
  node('registry','ToolRegistry',files.registry,'ToolRegistry',80,760,'本地对象表与函数表，支持注销'),
  node('calculator','CalculatorTool','tools/calculator_tool.py','CalculatorTool',380,760,'calculator 对象工具'),
  node('calculate','calculate()','tools/calculator_tool.py','calculate',680,760,'数学表达式 → AST → 结果文本','partial'),
  node('eval-node','_eval_node()','tools/calculator_tool.py','_eval_node',980,760,'递归计算常量、运算、调用与名称'),
  node('local-tool','Tool / ToolParameter','tools/base.py','Tool',1280,760,'本地工具接口与参数声明'),
  node('search','SearchTool','tools/search_tool.py','SearchTool.search',80,950,'统一对象工具，按顺序搜索与回退'),
  node('chain','ToolChain','tools/chain.py','ToolChain.execute',680,950,'顺序执行，模板传递前序结果'),
  node('async-tools','AsyncToolExecutor','tools/async_executor.py','AsyncToolExecutor.execute_tools_parallel',980,950,'线程池并发，按输入顺序返回'),
  node('message','Message','core/message.py','Message',80,1140,'Pydantic 消息与角色校验'),
  node('config','Config','core/config.py','Config',380,1140,'配置字段不自动应用到客户端','partial'),
  node('dict','Message.to_dict()','core/message.py','Message.to_dict',680,1140,'输出 role 和 content'),
  node('run','Agent.run()',files.agent,'Agent.run',980,1140,'约定子类执行入口的抽象方法'),
  node('history','历史消息管理',files.agent,'Agent.get_history',1280,1140,'添加、浅拷贝与清空'),
];

// 区分实际调用、继承、类型接口和注册绑定；不把不同示例拼成一条执行链。
export const relations=[
  ['main','factory','调用'],['main','client','迭代 think'],['factory','client','创建 LLM'],
  ['client','request','stream=True'],['invoke','request','stream=False'],
  ['agent-test','factory','创建模型'],['agent-test','simple','运行示例'],['agent-test','registry','创建注册表'],['agent-test','calculator','注册对象'],
  ['react-test','react','注入 FakeLLM 离线验证'],['react-test','calculator','注册对象'],
  ['calculator-test','factory','创建模型'],['calculator-test','registry','函数注册与执行'],['calculator-test','calculate','绑定 calculate'],['calculator-test','client','携结果请求模型'],
  ['simple','agent','继承'],['react','agent','继承'],['simple','invoke','无工具分支'],['simple','history','读取并保存'],
  ['simple','tool-loop','启用工具分支'],['simple','registry','持有注册表'],['stream-run','client','经 stream_invoke 转发'],['stream-run','history','完整迭代后保存'],
  ['tool-loop','invoke','迭代请求'],['tool-loop','tool-parse','解析文本标记'],['tool-loop','tool-execute','逐项执行'],['tool-execute','registry','execute_tool / get_tool'],
  ['react','invoke','逐步请求'],['react','registry','execute_tool'],['react','history','完成或超限时保存'],
  ['plan','client','Planner / Executor 消费 think'],['reflection','client','辅助方法消费 think'],
  ['registry','local-tool','对象表接口类型'],['calculator','local-tool','继承 Tool'],['calculator','calculate','run 调用'],['calculate','eval-node','递归求值'],
  ['search','registry','工厂注册对象'],['search','local-tool','继承 Tool'],
  ['chain','registry','顺序 execute_tool'],['async-tools','registry','线程池 execute_tool'],
  ['agent','message','历史元素类型'],['agent','config','保存配置'],['agent','run','抽象入口'],['agent','history','历史方法'],['message','dict','格式转换'],
];

const event=(node,title,text,data)=>({node,title,text,data});
export const flowExamples={
  main:[event('main','01 / 程序入口','当前 main.py 直接调用客户端，没有创建 Agent。','create_llm()'),event('factory','02 / 解析配置','同一服务的一组参数交给本地 LLM；演示不读取真实配置或凭证。','provider + model + base_url + key source'),event('client','03 / 创建生成器','think 是惰性生成器，此时尚未请求。','response_stream = llm.think(messages)'),event('request','04 / 开始迭代','迭代时合并请求参数，进入 SDK；本页面仅模拟。','_request(messages, stream=True, options=kwargs)'),event('client','05 / 返回片段','跳过无 choices 或空正文事件，打印并 yield。','delta.content → print → yield'),event('main','06 / 完成','外层 pass 继续消费；上下文管理器释放响应。','for chunk in response_stream: pass')],
  simple:[event('simple','01 / 组织上下文','系统提示词、历史和当前输入组成 messages。','system → history → user'),event('history','02 / 本地历史','get_history 来自 core/agent.py，返回浅拷贝。','self.get_history()'),event('invoke','03 / 完整回答','无工具分支调用本地 LLM.invoke。','response = self.llm.invoke(messages, **kwargs)'),event('history','04 / 保存问答','使用本地 Message，分别保存用户输入和回答。','self.add_message(Message(...))'),event('simple','05 / 返回结果','此路径是方法级模拟，main 没有接入 Agent。','return response')],
  tools:[event('simple','01 / 工具分支','注入注册表并启用工具；示例使用本地 CalculatorTool。','name = calculator'),event('tool-loop','02 / 请求模型','假设模型按约定返回工具文本标记。','[TOOL_CALL:calculator:15 * 8 + 32]'),event('tool-parse','03 / 解析标记','提取名称、参数与待清理的原始文本。','tool_name + parameters + original'),event('tool-execute','04 / 调度工具','calculator 走注册表分支，表达式被包装为 input 字典。','execute_tool → tool.run({input: expression})'),event('calculator','05 / 计算器对象','run 委托 calculate。结果 152 是教学数据，不实际执行工具。','CalculatorTool.run → calculate → 152'),event('tool-loop','06 / 回传结果','清理标记，把 assistant 文本和 user 工具结果追加到本轮上下文。','messages.append(...)'),event('invoke','07 / 再次请求','假设模型不再输出工具标记，得到最终回答。','final_response = response'),event('history','08 / 保存问答','只保存原始输入和最终答案，不保存全部工具轨迹。','user + assistant')],
  react:[event('react','01 / 重置任务轨迹','构造时选择非空 custom_prompt 或 DEFAULT_REACT_PROMPT；每次 run 清空 current_history。','prompt_template → current_history = []'),event('invoke','02 / 思考与行动','示例模型文本，不发送真实请求。','Thought: calculate\nAction: calculator[15 * 8 + 32]'),event('react','03 / 解析行动','本地方法解析 Thought / Action 与方括号输入。','_parse_output → _parse_action'),event('registry','04 / 统一调度','对象优先，通过 input 键交给 CalculatorTool。','execute_tool → CalculatorTool.run'),event('react','05 / 追加观察','把 Action 与 Observation 放入下一轮模板。','Observation: 152'),event('invoke','06 / 结束行动','假设模型返回 Finish，提取答案。','Action: Finish[152]'),event('history','07 / 保存问答','达到 Finish 或步数上限时保存原问题与最终回答。','Message(input_text) + Message(final_answer)')],
};

const step=(title,text,needle,end)=>({title,text,needle,end});
export const notes={};
const note=(file,symbol,summary,input,output,points=[],steps=[],warning)=>{
  notes[`${file}::${symbol}`]={summary,input,output,points,steps,warning};
};
note(files.llm,'create_llm','按服务选择整组配置，显式创建本地 LLM。','provider?, model?, config_path?','LLM 实例',[
  '显式参数优先，否则使用 JSON 默认服务和模型。','load_dotenv 不覆盖进程已有变量；索引与页面不执行此函数。','缺少键或环境变量直接报错，空密钥主动抛出 ValueError。'],[
  step('读取配置','从项目根目录加载环境并解析 JSON。','load_dotenv','config ='),step('选择服务','模型和地址来自同一配置。','provider =','base_url ='),step('选择凭证来源','只解析当前服务所声明的来源。','if "apiKeyEnv"','api_key = settings'),step('创建本地客户端','全部连接参数显式传入。','return LLM(','api_key=api_key')]);
note(files.llm,'LLM.__init__','保存连接信息和默认参数，创建 OpenAI 兼容 SDK 客户端。','model, api_key, base_url, provider 等','LLM 实例',['timeout 参数优先，否则读取 LLM_TIMEOUT，默认 60 秒。','初始化本身不发送模型请求；没有自动检测或切换 provider。']);
note(files.llm,'LLM._request','两种模型入口共用的请求参数合并方法。','messages, stream, options','SDK 响应或流对象',['调用选项覆盖默认 model、messages、temperature、max_tokens。','最后强制设置 stream，保持入口的响应类型。','底层 SDK 是 HTTP 边界，不在本地索引内；异常直接向上传播。'],[
  step('默认请求参数','先构造实例默认值。','parameters =','if self.max_tokens'),step('本次选项优先','合并后强制当前入口的 stream 值。','parameters.update(options)','parameters["stream"] ='),step('发送请求','调用 OpenAI 兼容 SDK。','return self._client.chat.completions.create')]);
note(files.llm,'LLM.invoke','非流式入口，等待完整响应后返回文本，不主动打印。','messages, **kwargs','str',['stream=True 会被拒绝；空正文返回空字符串。','底层请求异常直接向上传播。'],[step('限制响应模式','拒绝流式参数。','if kwargs.pop','raise ValueError'),step('请求并取文本','委托 _request，再提取第一项正文。','response = self._request','return response.choices')]);
note(files.llm,'LLM.think','迭代时才请求模型；打印并逐段 yield 正文。','messages, temperature?, **kwargs','Iterator[str]',['跳过没有 choices 或没有正文的事件。','with 管理流对象，完整结束、异常或显式关闭生成器时释放响应。','提前 break 若未关闭生成器，不保证立即释放；业务异常直接传播。'],[
  step('覆盖温度','本次 temperature 非空时进入请求选项。','if temperature is not None:','kwargs["temperature"]'),step('打开响应流','请求发生在生成器开始迭代时。','with self._request','for chunk in response:'),step('筛选与产出','先检查事件，再打印并返回片段。','if not chunk.choices:','yield content')]);
note(files.llm,'LLM.stream_invoke','用 yield from 转发 think 的选项和文本。','messages, **kwargs','Iterator[str]',['所有 kwargs 都继续传递给 think。'],[step('转交流式调用','点击 self.think 查看实现。','yield from self.think')]);
note(files.llm,'LLM.close','关闭 SDK 客户端持有的连接。','无','None',[],[step('关闭客户端','调用方在不再使用时主动调用。','self._client.close()')]);
note(files.agent,'Agent.__init__','本地抽象基类保存名称、客户端、提示词、配置和独立历史列表。','name, llm, system_prompt?, config?','公共实例状态',['SimpleAgent 与 ReActAgent 都继承此类。','Config() 不会自动应用到 LLM，历史也不会自动裁剪。']);
note(files.agent,'Agent.run','抽象执行接口，由具体 Agent 实现。','input_text, **kwargs','约定 str',['本类不能直接实例化；抽象接口不是未完成的具体对话实现。']);
note(files.agent,'Agent.get_history','返回历史列表浅拷贝。','无','list[Message]',['列表独立，内部消息对象仍共享。'],[step('复制容器','不复制内部 Message。','return self._history.copy()')]);
note(files.agent,'Agent.add_message','将本地 Message 追加到实例历史。','message','None',['保存时机由具体 Agent 决定，不自动限制长度。'],[step('追加消息','修改当前实例的历史。','self._history.append')]);
note(files.agent,'Agent.clear_history','清空当前实例的消息历史。','无','None',[],[step('清空列表','不影响其他实例。','self._history.clear()')]);
note('core/message.py','Message','用 Pydantic 校验内容与角色，并补充时间和元数据。','content, role, **kwargs','Message',['role: MessageRole 对应 user / assistant / system / tool。','kwargs 可提供 timestamp 和 metadata；未提供时使用当前时间和空字典。']);
note('core/message.py','Message.to_dict','转换为只包含 role 和 content 的 API 消息字典。','self','dict',['SimpleAgent 当前直接按字段组装字典，并没有调用此方法。']);
note('core/config.py','Config','本地配置字段与 from_env 工厂。','显式字段或 from_env()','Config',['Config() 使用默认值；from_env 才读取部分环境变量，本身不加载环境文件。','max_history_length 是配置字段；当前 Agent 未自动执行裁剪。','这些字段不会自动覆盖 create_llm 的配置或 LLM 默认参数。']);
note(files.simple,'SimpleAgent.__init__','初始化本地 Agent 基类，再保存注册表和工具开关。','name, llm, system_prompt?, config?, tool_registry?, enable_tool_calling?','SimpleAgent',['直接继承本地 core.agent.Agent。','初始工具开关同时要求允许调用且注册表不为 None。']);
note(files.simple,'SimpleAgent.run','组织上下文后，根据工具开关选择普通回答或多轮工具调用。','input_text, max_tool_iterations=3, **kwargs','最终回答 str',[],[
  step('增强提示词','本地工具说明加入系统消息。','enhanced_system_prompt =','messages.append({"role": "system"'),step('历史与当前输入','get_history 来自本地 Agent。','for msg in self.get_history():','messages.append({"role": "user"'),step('普通回答','invoke 后保存本地 Message。','if not self.enable_tool_calling:','return response'),step('工具回答','交给内部循环。','return self._run_with_tool_calling')]);
note(files.simple,'SimpleAgent._get_enhanced_system_prompt','在基础提示词后加入工具描述与文本标记约定。','self','str',['当前没有使用原生 tool_calls 接口；依赖模型遵守文本格式。']);
note(files.simple,'SimpleAgent._run_with_tool_calling','在本轮 messages 中反复请求、解析、执行并回传工具结果。','messages, input_text, max_tool_iterations, **kwargs','最终回答',['工具结果作为 user 消息，清理标记后的响应作为 assistant 消息。','达到上限后额外 invoke 一次，不再解析工具标记。','历史只保存原问题与最终回答。'],[
  step('循环请求','受工具轮数上限约束。','while current_iteration','response = self.llm.invoke'),step('解析与执行','逐项执行标记并清理原文。','tool_calls =','clean_response = clean_response.replace'),step('回传观察','追加上下文后增加轮数。','messages.append({"role" : "assistant"','current_iteration += 1'),step('超限与保存','必要时补充回答，最终保存问答。','if current_iteration >=','return final_response')]);
note(files.simple,'SimpleAgent._parse_tool_calls','正则提取工具标记，返回名称、参数与原始标记。','text','list[dict]',['不支持参数中的任意右方括号嵌套。']);
note(files.simple,'SimpleAgent._execute_tool_call','calculator 名称走注册表；其他名称解析参数后查对象并调用 run。','tool_name, parameters','结果或错误文本',['calculator 通过注册表执行对象工具，参数键为 input。','calculate 是函数注册名，get_tool 不查函数表；不能仅因已注册就假定 SimpleAgent 可调用。','本方法捕获工具异常并转成文本；注册表本身直接传播异常。'],[
  step('检查注册表','缺少注册表直接返回错误。','if not self.tool_registry:','return f'),step('特殊名称','只有字面名称 calculator 走统一调度。','if tool_name == "calculator":','result = self.tool_registry.execute_tool'),step('对象分支','解析后按名称取对象。','param_dict =','result = tool.run'),step('错误处理','工具异常转换为文字。','except Exception as e:','return f')]);
note(files.simple,'SimpleAgent._parse_tool_parameters','把简单 key=value 或普通文本转换成字典。','tool_name, parameters','dict',['值仍是字符串，不做类型转换；逗号拆分不是完整语法解析。','search 用 query；memory 用 action 和 query；其他默认 input。']);
note(files.simple,'SimpleAgent.stream_run','读取本地历史，转发模型片段，完整消费后保存问答。','input_text, **kwargs','Iterator[str]',['这条路径不执行工具循环。','提前停止或异常时，末尾保存历史可能不会执行。'],[step('读取历史','继承本地 Agent 方法。','for msg in self.get_history():'),step('流式转发','累积并 yield 片段。','for chunk in self.llm.stream_invoke','yield chunk'),step('保存完整问答','只有正常迭代结束才到这里。','self.add_message(Message(input_text','self.add_message(Message(full_response')]);
note(files.simple,'SimpleAgent.remove_tool','调用本地注册表 unregister_tool，移除指定名称。','tool_name','bool',['有注册表时返回 True；不会转发注册表的 found 值，因此 True 不表示名称原来一定存在。','实际调用的是本地注册表的 unregister_tool。']);
note(files.simple,'SimpleAgent.add_tool','必要时创建本地注册表，再注册对象工具。','tool','None',['已有注册表但开关关闭时，不会自动重新开启。']);
note(files.react,'ReActAgent.__init__','继承本地 Agent，保存注册表、步数上限与提示词模板。','name, llm, tool_registry, system_prompt?, config?, max_steps?, custom_prompt?','ReActAgent',['父类参数顺序与本地 Agent 一致。','custom_prompt 非空时优先，否则使用模块常量 DEFAULT_REACT_PROMPT；传入空字符串也会回退默认模板。'],[step('选择提示词模板','点击 DEFAULT_REACT_PROMPT 可查看真实模板。','self.prompt_template =')]);
note(files.react,'DEFAULT_REACT_PROMPT','ReAct 默认提示词：提供工具描述、问题与本轮执行历史，并约定 Thought / Action 格式。','tools, question, history 模板占位符','格式化后的提示词',['工具行动采用 calculator[表达式] 等格式，完成行动采用 Finish[最终答案]。','工具名称来自注册表说明，模板不是固定计算器专用提示词。']);
note(files.react,'ReActAgent.run','重置本轮轨迹，循环生成 Thought / Action，执行工具或 Finish。','input_text, **kwargs','最终答案或超限提示',['current_history 每次 run 清空，只追加 Action 和 Observation。','系统提示词和完整问答历史没有被单独加入请求；模型输入是格式化后的 user 消息。','无 Action 仍消耗一步；工具异常由注册表向上抛出，没有在此统一捕获。'],[
  step('重置任务轨迹','不会用上一轮的行动污染本轮模板。','self.current_history = []','current_step = 0'),step('构建与请求','工具说明、问题与当前轨迹组成提示词。','tools_desc =','response_text = self.llm.invoke'),step('完成分支','Finish 提取答案并保存本地 Message。','if action and action.startswith','return final_answer'),step('工具分支','执行后追加 Action 和 Observation。','if action:','self.current_history.append(f"Observation:'),step('步数耗尽','返回明确的未完成提示并保存。','final_answer = "抱歉','return final_answer')]);
note(files.react,'ReActAgent._parse_output','分别提取 Thought 和 Action 所在行。','text','tuple[Optional[str], Optional[str]]',['re.search 不启用 DOTALL，不收集多行完整 Thought。']);
note(files.react,'ReActAgent._parse_action','按 工具名[输入] 拆分名称与输入。','action_text','名称和输入，失败时为 (None, None)',['不是结构化 JSON 校验；使用正则匹配首段。']);
note(files.react,'ReActAgent._parse_action_input','复用行动解析，取 Finish 的方括号内答案。','action_text','str');
note(files.registry,'ToolRegistry','本地注册表保存对象和函数，执行时对象优先。','Tool 对象或函数','工具描述与执行结果',['get_tool 仅查对象；list_tools 合并去重；unregister_tool 清理两表。','对象或函数异常直接传播。'],[], 'to_openai_schema 仍依赖本类未定义的 get_parameters、name、description，不视为已接通的原生工具调用能力。');
note(files.registry,'ToolRegistry.execute_tool','先执行对象 run({input: parameters})，否则执行函数 func(parameters)。','name, parameters: str','工具结果或未找到文本',['对象和函数同名时优先对象。','通用入口只传 input；多参数对象可通过 get_tool 后自行传入字典。','本方法不捕获工具异常。'],[
  step('对象优先','传入标准 input 字典。','if name in self._tools:','return self._tools[name].run'),step('函数回退','保留原始字符串参数。','if name in self._functions:','return func(parameters)'),step('名称不存在','返回工具不存在文本。','return f"工具不存在:')]);
note(files.registry,'ToolRegistry.unregister_tool','同时删除对象表和函数表中的同名注册。','name','bool',['返回是否找到过名称，避免移除对象后回退到旧同名函数。']);
note(files.registry,'ToolRegistry.get_tool','只从对象表取工具，不查询函数。','name','Tool | None');
note(files.registry,'ToolRegistry.register_function','保存名称、描述和函数对象，不立即执行。','name, description, func','None',['func 可以是普通函数，也可以是实例的绑定方法。']);
note(files.registry,'ToolRegistry.register_tool','按 tool.name 保存对象，不立即执行。','tool','None');
note('tools/base.py','Tool','所有对象工具的本地抽象接口。','name, description','具体工具子类',['子类必须实现 run(dict) 和 get_parameters()。']);
note('tools/base.py','ToolParameter','Pydantic 工具参数声明。','name, type, description, required?, default?','参数对象',['参数描述本身不会自动校验 run 输入字典。']);
note('tools/calculator_tool.py','CalculatorTool','把现有 calculate 封装为本地 Tool 对象，注册名 calculator。','无','CalculatorTool',['与函数注册名 calculate 对应同一求值函数，但调度入口不同。']);
note('tools/calculator_tool.py','CalculatorTool.run','读取 input，缺失或为空时兼容 expression，然后调用 calculate。','parameters: dict','结果文本',[],[step('读取表达式','两个兼容键使用 or 连接。','expression = parameters.get'),step('委托函数','对象与函数工具共用求值实现。','return calculate(expression)')]);
note('tools/calculator_tool.py','calculate','用 ast.parse 解析表达式，再调用 _eval_node 递归求值。','expression: str','结果或指定异常的错误文本',['不调用内置 eval；允许 sqrt 和 pi。'],[
  step('检查输入','空输入立即返回。','if not expression.strip():','return "计算表达式'),step('解析与求值','取 node.body 交给递归函数。','node = ast.parse','return str(result)'),step('指定异常转文字','没有捕获任意异常。','except (SyntaxError','return f')], '运算表包含正负号，但没有 UnaryOp 分支；未知节点可能返回 None，属性调用等其他异常可能直接抛出。');
note('tools/calculator_tool.py','_eval_node','根据 AST 类型递归处理常量、二元运算、函数调用与名称。','node, operators, functions','节点值或 None',['BinOp 先算左右节点，Call 先算参数。','未匹配的节点或名称没有兜底 raise，可能隐式返回 None。']);
note('tools/calculator_tool.py','create_calculator_registry','创建本地注册表，将 calculate 绑定到 calculate。','无','ToolRegistry',['工厂返回新实例，不会自动与其他工厂合并。']);
note('agents/plan_solve_agent.py','PlanAndSolveAgent.run','先生成非空计划，再按顺序调用执行器。','question','最后一步回答或 None',['本类不继承 Agent；执行器是模型逐步解题，不是实际工具执行。']);
note('agents/plan_solve_agent.py','Planner.plan','消费 think，提取 python 围栏并用 literal_eval 解析列表。','question','list 或 []',['只检查为列表，不逐项验证字符串。','解析失败返回空列表，不执行模型生成的代码。']);
note('agents/plan_solve_agent.py','Executor.execute','为每个计划步骤组织上下文、消费模型文本并更新历史。','question, plan','最后一步回答',['不额外总结；直接调用时空计划会导致结果变量未赋值。']);
note('agents/reflection_agent.py','ReflectionAgent.run','初始回答后反复评审和改进，返回最近 execution。','task','最终生成内容',['本类独立于 Agent，使用自己的 Memory；每次 run 重置。','只有 feedback.strip() 完全等于“无需改进”才停止。','execution 是模型输出记录，不表示执行了生成代码。']);
note('agents/reflection_agent.py','ReflectionAgent._get_llm_response','消费 think 的片段并拼成完整字符串。','prompt','str');
note('agents/reflection_agent.py','Memory','保存 execution / reflection 轨迹。','无','Memory',['get_last_execution 从后向前取最近执行结果；get_trajectory 当前主循环未调用。']);
note('tools/search_tool.py','SearchTool.search','按配置顺序尝试搜索源，返回首个非空结果。','query','结果文本',['空查询和无后端返回提示；请求失败或空结果时尝试下一源。','Tavily 与 SerpApi 结果均保留标题、摘要与来源链接。','当前没有跨源融合或自动时间筛选。']);
note('tools/search_tool.py','create_search_registry','创建 SearchTool 并注册为 search 对象工具。','backend','ToolRegistry',['注册时不发起搜索。','注册表通过 input 传入查询；SimpleAgent 通过 query 传入查询。']);
note('tools/search_tool.py','SearchTool','统一搜索实现，继承本地 Tool。','backend, 可选凭证','SearchTool',['run 和 get_parameters 实现工具接口。','初始化只加载已配置且被选用的 SDK；SerpApi 使用 Client 接口。']);
note('tools/chain.py','ToolChain.execute','按既定步骤填充模板、调用工具并把结果写入 context。','registry, initial_input, context?','最后一步结果',['Agent 当前未自动接入此模块。','缺少模板变量时返回错误；工具错误文本不会自动中断，异常直接传播。','空步骤会在取最后一步时报错，研究示例也未自动把搜索摘要转换为算式。']);
note('tools/chain.py','ToolChainManager.execute_chain','按名称找到工具链，使用管理器持有的注册表执行。','chain_name, input_data, context?','工具链结果或未找到文本');
note('tools/async_executor.py','AsyncToolExecutor.execute_tools_parallel','为每项输入创建协程，再用 gather 调度并等待结果。','tasks','按输入顺序排列的 list[str]',['同步工具实际在线程池中执行，不阻塞事件循环。','工具异常默认传播；错误字符串不等于异常。','当前 Agent 没有自动调用此执行器。']);
note('tools/async_executor.py','AsyncToolExecutor.execute_tool_async','把 registry.execute_tool 放入线程池执行。','tool_name, input_data','await 得到的工具结果');
note('examples/calculator_demo.py','demo_calculator_with_llm','手动执行计算器，再调用 LLM.think 组织自然语言回答。','预设问题与表达式','终端回答',['由示例函数编排工具与模型，没有实例化 Agent。','think 内部打印，示例再次 print(chunk) 会重复输出。']);
note('examples/simple_agent_demo.py','','实际创建本地 SimpleAgent、注册表与 CalculatorTool。','create_llm 创建的客户端','终端响应与历史',['main 仅在直接运行模块时执行；导入不会请求模型。']);
note('tests/test_react_agent.py','test_calculator_result_reaches_next_model_request','使用 FakeLLM 和本地计算器，验证 Observation 进入下一轮提示词。','预设两轮模型文本','离线断言',['不调用真实模型或搜索服务。']);
