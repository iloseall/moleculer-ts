# Moleculer TypeScript 原生化改造文档

> 目标：把「JS 实现 + 同目录手写 `.d.ts`」的双文件结构，改造成 **TypeScript 原生单文件源码**（`src/**/*.ts`），
> 由 `tsc` 构建出 `dist/**/*.js` + `*.d.ts`，保持运行时行为等价、公共类型 API 不丢失，
> 并让编译配置**对齐 TypeScript 6.0 的默认值与废弃清单**。

---

## 一、最终状态

```
src/          133 个 .ts（原 133 个 .js + 115 个手写 .d.ts 已合并删除）+ 1 个 runner-esm.mjs
dist/         133 个 .js + 133 个 .d.ts + runner-esm.mjs（与 src 严格 1:1）
```

- 源文件删除：248 个（133 个 `.js` + 115 个 `.d.ts`）
- `src` 下残留 `.js` / `.d.ts`：**0**
- `examples/`：**27 个 `.js` → `.ts`**（跳过 `examples/esm/`——本身就是 ESM 示范；`examples/docker/`——独立的 Docker 消费者工程；
  `examples/runner/*.js`——仓库已自带同名 `.ts` 版本），`examples/` 下已无 `.js`
- `require()` 残留：**43 处，全部为刻意保留**（见第三节）
- `dist/` 已被 `.gitignore` 忽略，通过 `npm run build` 生成，CI / 发布流程前置执行

---

## 二、模块语法：全面改用 ESM `import`

`src/**/*.ts` 中原有的 602 处 `require()` 已系统性改写为 ESM `import`，共 **559 处转换**：

| 原形态 | 转换结果 | 数量 |
|---|---|---|
| `import X = require("s")` | `import X from "s"`（目标为 `export =` 模块 / 外部包） | 317 |
| `import X = require("s")` | `import * as X from "s"`（目标为具名导出模块，保留 `X.foo` 调用点不变） | 40 |
| `import X = require("s");` + `const { a, b } = X;` | `import { a, b } from "s"` | 43 |
| `import type X = require("s")` | `import type X from "s"` / `import type * as X from "s"` | 143 |
| `const X = require("s").prop` | `import { prop as X } from "s"` | 5 |
| `const { a, b } = require("s")`（含 3 处多行） | `import { a, b } from "s"` | 5 |
| `const { a } = require("s").types` | `import { types } from "s"; const { a } = types;` | 1 |
| `const X = require("s")` | `import X from "s"` / `import * as X from "s"` | 5 |

**转换规则**：按目标模块的导出形态分派 —— `export =` 用默认导入、具名导出用命名空间导入、
后续有解构则直接合成命名导入，从而**不修改任何调用点**。

### 刻意保留为 `require()` 的三类（共 43 处）

1. **JSON 数据读取（2 处）**：`src/health.ts`、`src/service-broker.ts` 的 `require("../package.json").version`
   —— 这是读数据文件而非模块，静态引入会触发 `rootDir`（TS6059）与 nodenext 的 JSON import attribute 要求
2. **函数体内的懒加载（36 处）**：
   - 可选依赖：`ioredis` / `redlock` / `bunyan` / `debug` / `log4js` / `pino` / `winston` / `etcd3` /
     `dotenv` / `cbor-x` / `msgpack5` / `notepack.io` / `moleculer-repl` / `dd-trace` / `jaeger-client` /
     `amqplib` / `rhea-promise` / `@platformatic/kafka` / `mqtt` / `nats`
   - 动态路径：`require(filePath)`（runner 加载服务文件）、`require(name)`、`require(fName)`、`require("./internals")()`
   - 规避循环依赖：`require("./service")`、`require("./context")`
3. **注释中的示例（6 处）**：不参与编译

> 这些位置改成顶层静态 import 会改变语义：可选依赖变成强制依赖、动态加载变成静态、循环依赖被激活。

---

## 三、编译配置：对齐 TypeScript 6.0

TS 6.0（2026-03 GA）一次性改了 9 项默认值并废弃了一批选项，7.0（Go 重写版）会**移除**全部废弃项。
因此本次直接按「升级到 6.0 后需要什么」来配置，避免二次返工。

### `tsconfig.json`

| 选项 | 取值 | 原因 |
|---|---|---|
| `module` | `nodenext` | `commonjs` 已非默认；package.json 无 `"type": "module"`，输出**仍是 CJS** |
| `moduleResolution` | `nodenext` | `node`（node10）在 6.0 废弃、7.0 移除；CJS 模式下 extensionless 相对导入仍可用 |
| `esModuleInterop` | `true` | 6.0 **强制锁死为 true**（不允许 `false`）；ESM import 也依赖它的互操作辅助函数 |
| `types` | `["node"]` | 6.0 默认由「全部 `@types/*`」变为 `[]`，必须显式声明 |
| `target` | `ES2022` | 6.0 默认浮动为 `es2025`；`es5` 已废弃（最低 es2015）。ES2022 在支持范围内 |
| `useDefineForClassFields` | `false`（**显式**） | 保持 ES2021 类字段赋值语义，避免子类字段覆盖父类赋值；显式写死可不受默认值漂移影响 |
| `strict` | `false`（**显式**） | 6.0 默认变 `true`，显式 `false` 仍被尊重；「先迁移后收紧」的计划保留 |
| `skipLibCheck` / `resolveJsonModule` / `noEmit` | 保持 | 与 6.0 无冲突 |

> 移除项核对：未使用 `baseUrl` / `outFile` / `downlevelIteration` / `module: amd·umd·system` /
> `asserts` 导入 / `module Foo {}` 旧命名空间语法（统一用 `namespace`）—— 天然兼容。
> `rootDir` 已在 `tsconfig.build.json` 显式设为 `src`，不受 6.0「默认改为 tsconfig 所在目录」影响。

### `export =` 与 TS 6.0

6.0 发布说明**未列出** `export =` / `import = require` 的任何变更或废弃（只有旧式 `module Foo {}` 语法改为报错）。
我们保留了 `export =`（只改 import 侧），因此：

- 编译产物仍是 `module.exports = X`，对 `require("moleculer")` 的消费者零影响
- 默认导入 `export =` 模块依赖 `esModuleInterop` 的 `__importDefault` 包装（`.default` = 原导出对象）

---

## 四、改造过程中解决的关键问题

### 1. 泛型方法签名丢失

旧 `.d.ts` 里 `call` / `mcall` / `emit` / `broadcast` / `broadcastLocal` / `callWithoutBalancer` / `createService`
都是**多行泛型重载**，机械合并时被丢掉，导致 `test/typescript/hello-world` 报
`Expected 0 type arguments, but got 3`。已按原语义还原为单条泛型签名。

### 2. `Cachers.Memory` 的「值 + 类型」双重身份

单测要求 `Cachers.register("X", …)` 后 `Cachers.X` 可读（需 `export =` 可变对象），
tsd 要求 `Cachers.Memory` 可作类型（需具名导出）。最终形态：

```ts
const Cachers: { /* 显式成员 */ [key: string]: any } = { /* … */ };
declare namespace Cachers {
	export type Memory = MemoryCacher; // …
}
export = Cachers;
```

### 3. 中间件 `this` 上下文（`TS2684`）

`ActionHandler<Service>` 中的 `Service` 若用 `import type Service = require(...)`，会触发
`TS2684: The 'this' context of type 'void' …`。改用默认导入后恢复正常。

### 4. JSDoc 类型断言在 `.ts` 中失效

`/** @type {X} */ (expr)` 只在 JS 中生效，`.ts` 中一律替换为真正的 `as X`。

### 5. 类型守卫的隐式谓词

`isPlainObject(x)` / `isString(x)` 等会把 `any` 收窄为 `object` / `string | String`，
在若干调用点补 `as any` 或放宽形参类型（代码中已注释说明）。

### 6. `Promise<void>` 与内部 `Promise<boolean>` 冲突

`emit` / `broadcast` / `broadcastLocal` 对外保持 `Promise<void>`，内部中间量声明 `any`，运行时零改动。

### 7. `fastest-validator` 的手工解包不再需要

旧代码因 `esModuleInterop: false` 需要
`const Validator = FVModule as unknown as typeof FVModule.default;`。
改用 `esModuleInterop: true` 后 `import Validator from "fastest-validator"` 在类型与运行时都直接成立
（`__importDefault` 会把 `module.exports` 变成 `.default`），手工解包的 8 行已删除。

### 8. **esbuild/tsx 与 `import = require()` 的语义差异（本轮最关键的发现）**

`import X = require("y")` 这种写法，当 `X` 只在**类型位置**使用时：

- `tsc` 会在产物中**消除**该 import（`dist/`、`jest`/ts-jest 因此完全正常）
- `esbuild`/`tsx` 会把它**保留为运行时 `require`**

于是 `src/registry/endpoint.ts`（原 JS 里只有 JSDoc `@typedef`、没有任何 require）凭空多出
`require("./registry")`，激活了 `endpoint → registry → endpoint-action → endpoint` 的循环依赖，
继承到未完成的 `module.exports` 直接崩溃：

```
TypeError: Class extends value [object Object] is not a constructor or null
```

**修复**：以 `tsc` 产出的 `dist/*.js` 作为「哪些 import 被消除」的真值来源，把纯类型用途的
import 显式标注为类型导入（`import type`）。这样 tsc 与 esbuild 行为一致，未迁移模块也不会再多出运行时 require。

### 9. 修复一个隐藏 bug

`src/transporters/tcp/udp-broadcaster.js` 原为 `require("../../../src/utils")`（自引用源码树），
在 `dist` 下会解析回 `src/`，直接导致 `npm run test:esm` 崩溃；已改为相对当前目录的引用。

### 10. `Middleware.localAction` 里 `next` 的 `this` 类型不可用

原类型为 `localAction?: (this: ServiceBroker, next: ActionHandler<Service>, action: ActionSchema) => ActionHandler<Service>`。
`ActionHandler<TThis>` 带 `this: TThis` 约束，而中间件包装函数在运行时是**普通函数调用**（真正的 action handler 已在
`Service._createAction` 中 `bind` 到服务），因此包装函数内调用 `next(ctx)` 会被判定为
`TS2684: The 'this' context of type 'void' is not assignable to method's 'this' of type 'Service<…>'`。

历史上前述配置（`esModuleInterop: false`）因 `skipLibCheck` 让该 d.ts 里的默认导入解析为 `any`，错误被意外掩盖；
**TS 6.0 强制 `esModuleInterop: true` 后所有用户都会撞上**，因此按运行时语义修正为 `ActionHandler<any>`：

```ts
localAction?: (
	this: ServiceBroker,
	next: ActionHandler<any>,   // 包装函数以普通调用方式执行 next(ctx)
	action: ActionSchema
) => ActionHandler<any>;
```

### 11. 示例与类型测试此前从未被 lint

`eslint.config.js` 原有的覆盖规则只匹配 `**/*.js`，因此 `examples/**/*.ts`、`test/typescript/**/*.ts`
长期不在 lint 范围内。本次统一为 `test / dev / benchmark / examples` 的 `.js` 与 `.ts` 都使用同一套放宽规则
（允许 `console`、未使用变量），并对其执行了一次 prettier 规范化。

### 12. 示例类型检查暴露的公开类型缺口（5 处，均已修库而非绕开）

把 `examples/**` 纳入类型检查后，暴露出**运行时支持但公开类型没声明**的配置形态。
这些不是示例的问题，而是所有用户都会撞上的类型缺口，因此统一在 `src` 侧补齐：

| 位置 | 缺口 | 依据（运行时确实支持） |
|---|---|---|
| `service-broker.ts` / `logger-factory.ts` | `logger: console` 不被接受 | `logger-factory.init()` 里有 `opts === true \|\| opts === console` 分支，且源码原本就得写 `(opts as any) === console` |
| 同上 | `logger: "Console"`（字符串）不被接受 | `init()` 中 `isString(o)` → `Loggers.resolve({ type: o })` |
| 同上 | `logger: ["Console"]`（字符串数组）不被接受 | `init()` 对数组元素逐个 `isString(o)` 处理 |
| `metrics/registry.ts` | `metrics.reporter` 不接受 reporter **实例** | `Reporters.resolve()` 中 `isInheritedClass(opt, Reporters.Base)` 直接放行实例 |
| `service.ts` → `ActionSchema` | `action.protected` 未声明 | `service-catalog.ts` 读 `action.protected === true` |
| `service.ts` → `ActionSchema` | `action.description` 未声明 | REPL / API 网关 / 文档工具依赖该元数据 |
| `registry/registry.ts` | `DiscovererType` 未 `export` | 与已导出的 `TransporterType` 对称，环境变量写法需要它 |
| `utils.ts` | `uniq()` 返回 `any[]`（此前推断成 `unknown[]`） | 调用点普遍按数组使用 |

配套：`BrokerOptions.logger` / `LoggerFactory.init()` 的联合类型补上 `Console`、`string`、`(LoggerConfig | string)[]`、`BaseLogger<LoggerOptions>`。

### 13. 示例里已经跑不通的 API 用法（迁移时顺手修正）

| 文件 | 旧写法 | 问题与修正 |
|---|---|---|
| `stat.service.js` | `"metrics.trace.span.finish"(payload)` | 新版事件回调收到的是 **Context**；改为 `(ctx)` + `const payload = ctx.params` |
| `es6.class.service.js` | `meta: { scalable: true }` | 核心只读 `schema.metadata`（`Service.metadata = schema.metadata`），`meta` 全库无引用 → 改 `metadata` |
| `master.js` | repl 命令里的 `types: {}` | 内容全被注释掉，且不在类型里 → 删除（空对象，无行为影响） |

### 14. 第三方依赖已升级、示例仍停留在旧 API（保留原样 + 注释说明）

| 文件 | 情况 | 处理 |
|---|---|---|
| `loadtest/nats.ts` | 面向 nats v1（`connect()` 同步返回连接），现装的是 v2（返回 Promise） | 保持原逻辑，连接变量标注为 `any`，文件头加 NOTE |
| `opentelemetry/tracing.ts` | 面向旧 OTel API（`NodeTracerProvider` + `addSpanProcessor` + `resources.Resource`），现装的是新版 SDK | 保持原逻辑，三处最小 `as any` 转换 + NOTE |

两者**改造前就已无法运行**，属于示例陈旧，不属于本次迁移目标；已用注释标注，留待独立任务处理。

### 15. 补齐 `ActionSchema` / `EventSchema` 的运行时字段（并收口隐式 `any` 绕过）

`ActionSchema` 同时承担两种角色：用户写的**输入 schema**，以及 `Service._createAction()` 产出并贯穿注册表 / 端点 / `ctx` 的**运行时 action 记录**。后者会原地补上 `service`、`rawName` 与绑定后的 `handler`；同理 `EventSchema` 会被 `_createEvent()` 补上 `service`。但上游类型只声明了 `service?`，**漏了 4 个运行时真会被读的字段**：

| 成员 | 改造前状况 | 处理 |
|---|---|---|
| `service?: Service` | 上游 `src/service.d.ts` 就有，但**无任何说明**，看着像"用户该填的字段" | 加 `@internal` 文档：由 `_createAction()` 注入（`action.service = this`）；定义会先 `cloneDeep`，写了也会被真实实例覆盖 |
| `rawName?: string` | `_createAction()` 会注入（`action.rawName = action.name \|\| name`，随后 `name` 被加上 `<fullName>.` 前缀），但类型里**没有声明** | 补声明 + `@internal` |
| `timeout?: number` | 上游类型里没有，但 `middlewares/timeout.ts` 会读 `action.timeout`（`if (actionTimeout != null) ctx.options.timeout = actionTimeout`）→ **用户写 `actions: { x: { timeout: 5000 } }` 会被对象字面量的 excess property check 直接拒绝** | 补 `timeout?: number` + 注释：未设置时回落到 `BrokerOptions.requestTimeout`，`0`/负数表示禁用 |
| `EventSchema.bulkhead` / `EventSchema.tracing` | 上游类型同样没有，但 bulkhead / tracing 中间件在**事件路径**上会读 `event.bulkhead`、`event.tracing`；`TracingEventOptions` 早就定义了却全库无人引用（就是漏了这两个字段的旁证） | 补 `bulkhead?: BulkheadOptions;` 与 `tracing?: boolean \| TracingEventOptions;` |
| `BulkheadOptions`（新增接口） | `ActionSchema.bulkhead`、`BrokerOptions.bulkhead` 原先是 `Record<string, any>`（上游本有 `BulkheadOptions`，`.d.ts` 合并进源码时丢了） | 按 bulkhead 中间件实际读取的 `opts.enabled / concurrency / maxQueueSize` 定义 `export interface BulkheadOptions`，供 `ActionSchema` / `EventSchema` / `BrokerOptions` 三处共用 |

`EventSchema` 同源（`_createEvent()` 注入 `event.service`，供 `ctx.service` 使用），一并加注释；两个接口也补了"同一 shape 复用为运行时记录"的说明。

配套事实：`tsconfig` 全仓都**没开 `stripInternal`**，因此 `@internal` 只作文档语义，`service` / `rawName` 等字段仍完整保留在产出的 `dist/*.d.ts` 中，不会影响既有消费者。

#### 15.1 顺带收口 7 处"隐式 `any` 绕过"

上面这些字段以前**能被读到却不报错**，只是因为中间件内部函数的参数没写类型（全仓 `strict: false`，隐式 `any` 不报错）。补完字段后给 action / event 参数加了显式标注：

| 文件 | 函数 | 标注 |
|---|---|---|
| `middlewares/timeout.ts` | `wrapTimeoutMiddleware` | `action: ActionSchema` |
| `middlewares/action-hook.ts` | `wrapActionHookMiddleware` | `action: ActionSchema` |
| `middlewares/retry.ts` | `wrapRetryMiddleware` | `action: ActionSchema` |
| `middlewares/tracing.ts` | `tracingLocalActionMiddleware` / `tracingLocalEventMiddleware` | `action: ActionSchema` / `event: EventSchema` |
| `middlewares/bulkhead.ts` | `wrapActionBulkheadMiddleware` / `wrapEventBulkheadMiddleware` | `action: ActionSchema` / `event: EventSchema` |

`handler` 与 `ctx` 仍保持隐式 `any`（`ctx` 上有 `ctx._retryAttempts`、`ctx.startHrTime` 这类内部字段，收口它们属于"逐步开 `strict`"的范畴，不在本次范围）。

**只有 `tracing.ts` 需要改逻辑**：原来 `let opts = action.tracing;` 之所以能过，是因为 `opts` 被推断成 `any`；标注后 `opts` 变成 `boolean | TracingActionOptions`，属性访问全部报 `TS2339`。因此按原有语义显式归一化：

```ts
// 改前（依赖 opts: any）
let opts = action.tracing;
if (opts === true || opts === false) opts = { enabled: !!opts };
opts = _.defaultsDeep({}, opts, { enabled: true });
```
```ts
// 改后（四种输入逐一等价）
const opts: TracingActionOptions = _.defaultsDeep(
	{},
	typeof action.tracing === "boolean" ? { enabled: action.tracing } : action.tracing || {},
	{ enabled: true }
);
```

四种输入的合并结果与改前完全一致：`true → enabled: true`、`false → enabled: false`（`defaultsDeep` 不会覆盖已有值）、`undefined → 默认 enabled: true`、对象 → 原样合并；`opts` 全程只读，`let → const` 无副作用。tracing 相关 spec 全绿可佐证。

**验证**：`tsc -p tsconfig.json` **0 error**；负向验证 —— 故意把 `action-hook.ts` 里的 `action.rawName` 写成 `action.rawNameTEMP`，立刻报 `TS2339: Property 'rawNameTEMP' does not exist on type 'ActionSchema<...>'`，证明这些读取现在真的受类型检查（而不是被 `any` 放行）；`npm test` 137 suites / **2360 passed** / 4 skipped 与基线一致；`npm run build`、`test:tscheck`、`test:examples`、`test:ts` 全绿；`eslint src`（`endOfLine:auto` 口径）**0 problem**。

> 相关但本次未改：① 中间件里的 `ctx` 仍是隐式 `any`；② `registry/action-catalog.ts`、`registry/service-catalog.ts` 用 `Omit<ActionSchema, "handler" | "remoteHandler" | "service">` 描述"可序列化的纯 schema"，是否把 `rawName` 也并入 `Omit` 属公开类型议题；③ 更彻底的"输入 schema / 运行时 `Action`"类型拆分见第十一章。

---

## 五、门禁验证（改造后全量运行）

| 门禁 | 结果 |
|---|---|
| `tsc -p tsconfig.json` | **0 error**（1.5s） |
| `tsc -p tsconfig.examples.json`（src + 全部 examples） | **0 error** |
| `npx jest`（全部 spec 为 `.ts` 后） | **137 suites / 2360 passed / 0 failed / 4 pending** |
| `npm run test:tscheck`（`test/helpers/**` 类型门禁） | **0 error** |
| ESLint `test`（`--rule prettier endOfLine auto` 口径） | **0 problem** |
| ESLint `examples src`（同上口径） | **0 error / 0 warning** |
| `npm run build` | 通过，`dist/` 与 `src` **1:1**（133 js + 133 d.ts + runner-esm.mjs） |
| `npm run test:ts`（build + tsd + hello-world 编译 + ts-node 运行） | 通过（tsd 0 error，示例服务正常启停） |
| `npm run test:esm` | 通过（3 个服务启动成功） |
| `npm run test:examples`（build + 示例类型检查） | 通过 |
| ESLint `examples src` | **0 error / 15 warning**（均为未使用变量；忽略行尾差异口径） |
| `tsx examples/index.ts simple`（`npm run demo simple`） | 通过：4 次调用成功 + 1 次预期中的除零报错 |
| `tsx examples/index.ts middlewares` | 通过：中间件链 mw1/mw2/mw3 全执行、缓存命中演示正常、0 报错 |
| `tsx examples/start-es6.ts` | 通过：`v2.greeter`（class 版服务）正常启动 |
| `tsx examples/loadtest/local.ts` | 通过：吞吐循环正常（约 2.1~2.5M req/s） |
| 12 个服务文件逐个 `broker.loadService()` | **11 个 OK**（`dummy.service.ts` 按设计抛「Service name can't be empty」） |
| `tsx examples/client-server/server.ts` + `client.ts` | 通过：16 次 `math.add` 全部成功、3 次事件回声正常、0 报错 |
| `require("./index.js")` / `import from "./index.mjs"` | 正常 |

> 类型检查口径：从最初的 **152 处错误**（示例中）降到 **0**，其中大部分并非语法问题，而是
> 「类型收紧后暴露的真实问题」——见第四节第 12~14 条。

---

## 六、基础设施改动清单

### `package.json`

| 项 | 说明 |
|---|---|
| `build` / `clean` / `prepublishOnly` | 新增；`prepublishOnly` 确保发布前一定构建 |
| `files` | `src` → `dist` |
| jest | 新增 `ts-jest` transform（`diagnostics: false`，仅转译不做类型检查）；**136 个 `.spec.js` 已迁移为 `.spec.ts`**（见第七章） |
| `test:unit` / `test:int` | `--testMatch` 由 `*.spec.js` 改为 `*.spec.ts` |
| `test:tscheck` | 新增：`tsc -p tsconfig.test.json`，即 `test/helpers/**` 的类型门禁 |
| `tsd.compilerOptions` | 增加 `esModuleInterop: true`（不影响 src 配置） |
| `dev` / `demo` / `bench` / `perf` / `memleak` | 改走 `tsx`，可直接解析 `.ts` |
| `demo:client-server:server` / `demo:client-server:client` | 新增，运行示例 |
| `lint` / `lint:fix` | 范围加入 `dev`（第九章；`dev` 现有 0 error / 3 个既有 warning） |
| `test:ts` / `test:esm` / `test:examples` | 前置 `npm run build` |

### 示例与类型测试的类型检查门禁

| 文件 | 说明 |
|---|---|
| `tsconfig.examples.json`（新增） | 继承根配置，`include` 覆盖 `src/**/*.ts` + `examples/**/*.ts`；因为 `examples/typescript/index.ts` 通过 `"../../"` 引用包根，所以**必须先生成 `dist/`** |
| `package.json` → `test:examples` | `npm run build && tsc -p tsconfig.examples.json` |
| `.github/workflows/ci.yml` | 新增 `Type-check examples` 步骤；同时把 `examples/**` 从 `paths-ignore` 移除（否则只改示例的提交不会触发该门禁） |
| `eslint.config.js` | `test / dev / benchmark / examples` 的 `.js` 与 `.ts` 共用放宽规则块，且置于 `**/*.ts` 规则块**之后**（配置数组后者覆盖前者） |

### 入口与路径

- `index.js`、`index.d.ts`、`index.mjs`、`bin/moleculer-runner.mjs`：`./src/...` → `./dist/...`
- `test/typescript/hello-world/greeter.service.ts`：模块增强路径 `../../../src/service` → `../../../dist/service`

### 工程配置

- **ESLint**：接入 `typescript-eslint`，为 `**/*.ts` 增加规则块；CJS 场景、`any`、`declare namespace`、
  遗留 `@ts-ignore` 等按原状保留；`test / dev / benchmark / examples` 的 `.ts` 与 `.js` 共用放宽规则
  （允许 `console`、允许未使用变量 —— 含 `@typescript-eslint/no-unused-vars`，见 7.5）
- **CI**：`ci.yml` 增加 Build 与 `Type-check examples` 步骤；`publish.yml` 增加 Build 步骤

---

## 七、测试文件的 TypeScript 化（jest 保持不变）

测试运行器仍是 **jest 29 + ts-jest 29**，不引入 node:test：只把测试文件本身从 `.js` 改为 `.ts`，
并把原先分散的测试工具收敛成一套统一的 helper 层。

### 7.1 范围与结果

| 项 | 数量 |
|---|---|
| `test/unit/**/*.spec.js` → `.spec.ts` | 121 |
| `test/integration/*.spec.js` → `.spec.ts` | 15 |
| `*.spec.js.snap` → `*.spec.ts.snap` | 15（分布在 6 个 `__snapshots__` 目录） |
| 配套 helper / fixture 转 `.ts` | `test/integration/helpers.js`、`test/unit/__factories/*`（3 个） |
| 删除（内容已被 `test/helpers/*` 取代，全仓库 0 引用） | `test/unit/utils.js` |
| 保持 `.js` | `test/services/*.js`（5 个服务 fixture） |
| 保持 `.js`（不在迁移范围） | `test/e2e/*`（docker）、`test/esm/*`（runner）、`test/leak-detection/*.spc.js`、`test/typescript/*` |

**零测试丢失校验**：逐文件比对 HEAD 的 `.spec.js` 与迁移后的 `.spec.ts`，`it(` 计数 **2353 = 2353**，
`protectReject` 引用数也一致；4 个 pending 是迁移前就存在的 `describe.skip` / `it.skip`
（`unit/utils.spec.ts`、`unit/middlewares/context-tracker.spec.ts` ×2、`integration/circuit-breaker.spec.ts`）。

### 7.2 `test/services/*.js` 为什么刻意保持 `.js`

它们不是测试文件，而是被 `test/unit/service-broker.spec.ts` 以**文件名字符串**加载的服务 fixture：

- `broker.loadService("./test/services/math.service.js")`
- 断言里写死了具体文件名：`expect(broker.loadService).toHaveBeenCalledWith(path.normalize("test/services/users.service.js"))`
- 还有「重复加载应 throw」的用例依赖同名文件的加载语义

转成 `.ts` 会同时改变加载路径与断言内容，因此保留 `.js`（并仍在 jest 的 `coveragePathIgnorePatterns` 中）。

### 7.3 帮助层（四个文件， spec 的统一入口）

| 文件 | 职责 |
|---|---|
| `test/helpers/test.ts` | jest 门面：`describe` / `it` / `before` / `after` / `mock`；**`before`/`after` 映射为 jest 的 `beforeAll`/`afterAll`**（jest 没有 `before`/`after` 这个名字，首次跑会报 `TypeError: (0 , test_1.before) is not a function`） |
| `test/helpers/expect.ts` | 包装 jest 原生 `expect`（注册 `toBeAnyOf` 后默认导出） |
| `test/helpers/module-mock.ts` | `autoMock` / `autoShape` / `installMock` / `factoryMock` / `requireActual` / `interopDefault`，内部转发 `jest.mock`、`jest.createMockFromModule`、`jest.requireActual` |
| `test/helpers/utils.ts` | `protectReject` + `extendExpect`（注册 `toBeAnyOf`） |
| `test/helpers/matchers.d.ts` | 为运行期注册的 `toBeAnyOf` 补声明聚合（`declare module "expect"`），让类型门禁识别它 |
| `test/helpers/expect.spec.ts` | helper 层自测（14 项） |

spec 一律从 `../../helpers/test` 与 `../../helpers/expect` 导入，不直接碰 `@jest/globals`，
便于将来再换运行器时只改这一层。

### 7.4 迁移中踩到的坑（后续改弊值时必须遵守）

1. **延迟 `require()` 规则**：需要 mock 的模块，其 `require()` 必须写在 `autoMock(require.resolve("x"))` **之后**。
2. **`interopDefault` 陷阱**：当被测模块内部是 `require("pkg")` 而非 ESM `import` 时（如 `src/transporters/mqtt.ts`），
   spec 侧**不能**用 `interopDefault(require("pkg"))` —— automock 下 `mod.default` 与顶层成员是**两个不同 mock**，
   补丁必须打在模块导出本身。mqtt 案例的表现是 worker 崩溃（`Cannot read properties of undefined (reading 'on')`）。
   同类 symptom（「调用打进 automock 返回 undefined」）按同一思路排查。
3. **`expect` 是 jest 原生实现**，因此：`toBeAnyOf` 接受**数组**（`expect(x).toBeAnyOf(["a","b"])`）、
   恢复 spy 用 `spy.mockRestore()`（jest 的 mock context 上没有 `mock.restore`）。
4. **`import * as ns` 可写**：ts-jest 的 `__importStar` 因 `__esModule` 返回真实 exports 对象，
   `ns.fn = mock.fn()` 与 `mock.method(ns, "fn")` 都可用，**不需要**任何 `require.cache` hack。
5. **`before`/`after` 必须映射**，见 7.3。

### 7.5 类型门禁与转译配置

| 文件 | 说明 |
|---|---|
| `tsconfig.jest.json`（新增） | ts-jest 专用：继承根配置，覆盖 `module: commonjs` / `moduleResolution: node` / `isolatedModules: true` / `esModuleInterop: true`；把已废弃的 `isolatedModules` 选项从 jest transform 里挪出，消除告警，同时不影响 `src` 构建配置 |
| `tsconfig.test.json`（新增） | **只 gate `test/helpers/**`**（外加 `src/**/*.ts` 与 `types/extends.d.ts`），命令 `npm run test:tscheck`。136 个 spec **故意不进**这道门禁：它们原为 JS，且刻意包含类型违规用例（`new Context()` 无参、mock 赋给严格类成员、部分 endpoint 对象等），全面收紧是独立工作量 |
| `package.json` → `jest.testMatch` | `["**/*.spec.ts", "**/*.spec.js"]`（保留 `.js` 以兼容 `test/leak-detection/*.spc.js` 之外的历史 spec） |
| `package.json` → `jest.coveragePathIgnorePatterns` | 移除已删除的 `/test/unit/utils.js` |
| `eslint.config.js` | `test / dev / benchmark / examples` 的放宽块增加 `"@typescript-eslint/no-unused-vars": "off"`（与该块原有的 `no-unused-vars: off` 对齐：spec 会因夹具、WIP 用例保留未使用的导入与变量） |

### 7.6 顺带完成的 lint 收敛

同一份代码在 `.js` 下不被 `prefer-const` 约束，改成 `.ts` 后开始报 —— 迁移前 `npx eslint test` 是 **0 problem**
（已用 HEAD 版本的 spec 实测对齐），迁移后一度出现约 1580 处问题（`prefer-const` 1407、未使用变量 80、
失效的 eslint-disable 指令 40、`prettier` 59、尾随空格 1）。

处理方式：`npx eslint test --fix` 做**机械修复**（`let → const`、格式化、删失效指令），
剩余 4 处「`let x;` 在 `describe` 顶层声明、`before()` 里赋值」的写法手工改为声明即初始化
（`service-broker.spec.ts` 3 处、`tracing/span.spec.ts` 1 处），未使用变量按 7.5 的放宽规则处理。
收敛后 `eslint test` 回到 **0 problem**，且全量测试与覆盖率不变。

---

## 八、示例改造（`examples/client-server`）

`server.js` / `client.js` → `server.ts` / `client.ts`，除语法迁移外还修正了**在新版本 API 下已跑不通的写法**：

| 问题 | 旧写法 | 新写法 |
|---|---|---|
| 事件处理器签名 | `"echo.event"(data, sender)` | `"echo.event"(ctx)`（运行时是 `handler(ctx)`；`ctx.params` 是负载，`ctx.nodeID` 是发送方） |
| 熔断事件字段 | `payload.node.id` | `ctx.params.nodeID`（实际广播的字段是 `nodeID`） |
| 日志选项 | `logger: console` | `logger: { type: "Console" }`（类型化） |
| 环境变量 | `logLevel: process.env.LOGLEVEL` | `as LogLevels` |
| 传输器 | `transporter: string` | `as TransporterType` |
| 服务局部变量 | `this.counter = 1` | `createService<ServiceSettingSchema, Record<string, any>, LocalVars>` |
| 失效配置 | `circuitBreaker.maxFailures` | 移除（全库无任何引用） |
| kleur 调用 | `bold("…", count)` | `bold(\`… ${count}\`)`（kleur 只接受 1 个参数） |

运行方式：

```bash
# 终端 1
npm run demo:client-server:server
# 终端 2
npm run demo:client-server:client
```

### 其余示例：27 个 `.js` → `.ts`

`examples/` 下除 `esm/`（ESM 示范本身）、`docker/`（独立 Docker 消费者工程，用 `node:8-alpine` + 发布包，
里面没有 TS 运行时）、`runner/*.js`（仓库已自带同名 `.ts` 版本）外，全部完成 TS 化。

**迁移形态映射**（codemod 处理，再逐个修类型错误）：

| 原形态 | 转换结果 | 例 |
|---|---|---|
| `const X = require("../../src/y")` | `import X from "../../src/y"` | `simple/index.ts` |
| `const { a, b } = require("x")` | `import { a, b } from "x"` | `loadtest/client.ts` |
| `module.exports = { … }` | `const XxxSchema: ServiceSchema = { … }; export default XxxSchema;` | `math.service.ts` 等 8 个服务 |
| `module.exports = function (…) { … }` | `export default function (…): ServiceSchema { … }` | `post/user/user.v1.service.ts` |
| `module.exports = class` | `export default class` | `es6.class.service.ts` |
| 类里构造函数动态挂字段 | 补字段声明（同 `src` 的处理方式） | `stat.service.ts` 两个类 |
| 自定义 `settings` | 声明 `interface XxxSettings extends ServiceSettingSchema` | `es6.class` / `silent` / `node-controller` |
| 环境变量字符串 → 联合类型 | `as TransporterType` / `as DiscovererType` / `as LogLevels` | `multi-nodes` / `loadtest` |

**服务文件的加载路径同步改后缀**：`loadService("…/math.service.js")` → `"…/math.service.ts"`；
`require("./master.js")` → `require("./master.ts")`（cluster 分支加载，必须保持惰性）。
调度器 `examples/index.ts` 的 `require("./" + moduleName)` 保持不变——`tsx` 能正确把目录解析到 `index.ts`（已实测）。

**刻意跳过/无法运行的部分**：

- `examples/multi-nodes/*`：默认 transporter 是 NATS（`nats` 未作为依赖安装），本机无法实跑，仅保证类型通过
- `examples/opentelemetry/*`：需要 Redis transporter + OTel collector，本机无法实跑，仅保证类型通过
- `examples/loadtest/{client,server}.ts`：需要实际传输器与多节点，同上

---

## 九、dev/ 开发脚本（78 个：70 → `.ts`，8 保持 `.js`）

`dev/` 是开发期试验脚本的集合（原为 78 个 `.js`，绝大多数不在任何自动化覆盖内）。本轮按「**能否被 TS 化**」而非「代码长短」做判定，结果为 **70 个转 `.ts`**、**8 个保持 `.js`**。

### 9.1 判定标准：命中任一条就保持 `.js`

1. **会被非 tsx 环境按「路径/文件名字符串」加载**：`index.js`（`require("./" + name)` 派发器，且 `package.json` 的 `dev` 脚本写死 `tsx watch dev/index.js`）、`cluster.js`（`cluster.fork` 的 worker 目标是 `./client.js` 字符串）。
2. **本身就在示范「原生 JS 语义」**：`native-service.js`（纯 JS 服务定义写法），转 TS 即失去示范意义。
3. **无法自动化验证、或必须按路径直接读取**：`jsrepl.js`（交互式 REPL，需要 stdin）、`dev.config.js`（运行时配置文件）、`empty.service.js`（空 fixture）、`client.js` / `server.js`（cluster 体系成员，且依赖缺失的 `./RedisHeartbeat` 与多个远程传输器）。

### 9.2 分组结果（33 + 37 + 8 = 78，全覆盖）

| 组 | 数量 | 文件 | 验证方式 |
|---|---|---|---|
| **A：转 `.ts`，可本地冒烟** | 33 | `action-hooks, async-local-storage, breaker, bulkhead, cache, caller, debounce-throttle, duplex-streaming, errorHandler, es6-class, event-store, event-validator, hook-wildcard, i18n-validator, internal-errors, internal, issue-1121, issue-1137, issue-1241, issue-1333, issue-546, logger, method-mw, mw-order, perf, retries, SafeJsonSerializer, saga, schema-custom-merge, serializer-register, timeout, validator-async, validator` | 迁移前后逐个 `tsx` 跑，比对退出码与输出 |
| **B：转 `.ts`，需外部 infra** | 37 | `base, bigfile-sender, bigfile.receiver, broadcast-groups, buffer, circular, compress, custom-context, dev, direct-call, encrypt, event-error, event-wildcard, gossip-viz, headers, inter-ns, issue-1100-receiver, issue-1100-sender, issue-1132, issue-777, lifecycle, loglevel, metrics, middleware_v2, nats-wildcard, remote-deps, sharding, shared-obj, stream-caller, stream-demo, stream-echo, stream-java, stream-obj, stream-receiver, stream-sender, tracing, tracking` | 静态三层：语法 / 引用可达 / lint |
| **C：保持 `.js`，引用改 `dist`** | 8 | `index.js, empty.service.js, native-service.js, dev.config.js, cluster.js, client.js, server.js, jsrepl.js` | 引用可达校验 + 运行前置 `npm run build` |

### 9.3 两种引用策略（为什么 A/B 与 C 不一样）

| | A/B 组（`.ts`） | C 组（`.js`） |
|---|---|---|
| 模块引用 | 仍 `../src/*` | 改 `../dist/*` |
| 运行器 | `tsx`（跑 `.ts` 的唯一方式） | 原生 `node` |
| 语义 | 改 `src` 立即生效（开发态所需） | 读构建产物，**运行前必须先 `npm run build`** |
| 先例 | `examples/*.ts` | 根 `index.js`（本就 `require("./dist/...")`） |

C 组实际改写的共 **6 处**：`client.js` 2 处（`service-broker` / `utils`）、`server.js` 3 处（`service-broker` / `errors` / `utils`）、`jsrepl.js` 1 处（`service-broker`）；其余 5 个文件本就不引用 `src`。C 组未改动的 `client.js` / `server.js` 里 `require("..")` / `require("../")` 无需处理 —— 根 `index.js` 已指向 `./dist/*`。

### 9.4 运行方式

```bash
# A/B 组：走派发器（tsx 能解析 .ts）或直接跑单文件
npm run dev validator          # = tsx watch dev/index.js validator
npx tsx dev/validator.ts

# C 组：原生 node，先构建
npm run build
node dev/client.js
node dev/jsrepl.js
```

### 9.5 迁移形态与刻意保留的 `require()`

形态与 `examples/` 同源 codemod：`const X = require("../src/y")` → `import X from "../src/y"`、`const { a } = require("../src/y")` → `import { a } from "../src/y"`、`module.exports = X` → `export default X`。

**在 `.ts` 里刻意保留 `require()` 的 7 个文件（12 处）**，原因与第二章「刻意保留为 `require()` 的三类」一致（`import = require()` 在 esbuild/tsx 下与 `require()` 语义不同，属性访问与带初始化的调用一律不动）：

| 文件 | 保留内容 | 原因 |
|---|---|---|
| `compress.ts` / `encrypt.ts` | `require("..").Middlewares` | 属性访问命名空间 |
| `SafeJsonSerializer.ts` | `require("..").Serializers.Base` | 同上 |
| `metrics.ts` | `require("../src/metrics/reporters").CSV` | 同上（同名成员与目录同名） |
| `tracing.ts` | `require("dd-trace").init({...})`、局部 `require("http")` | 副作用顺序 + 惰性加载 |
| `issue-1137.ts` | `require("../").Validators.Base` 等 4 处 | 复现 issue 场景，保持原样 |
| `issue-1333.ts` | `require("moleculer").Validators.Base` 等 2 处 | 同上（`moleculer` 未安装，本就是坏引用） |

### 9.6 验证结果

- **A 组行为对比**：迁移前后各跑一遍（`tsx`，统一超时口径），**33/33** 退出码与归一化输出一致（长期运行的 broker 脚本超时视为正常）。
- **B 组行为对比**：同样 **37/37** 一致（退出码全等；输出差异仅剩 `at ...` 栈帧噪声）。
- **语法/引用静态校验**：70 个 `.ts` 全部通过 `esbuild.transform`；相对引用里唯一解析不到的是 `i18n-validator.ts → ../src/validator`（**迁移前就存在的坏引用**，`src/validator.ts` 从不存在，按「只记录不修」处理）。
- **`eslint dev`**：**0 error** / 3 warning（3 个 `security/detect-possible-timing-attacks`，已用 HEAD 的 `.js` 复核同为 3 个，非本次引入）；`dev` 已并入 `npm run lint` 范围。
- **C 组引用可达**：`../dist/*` **6/6** 可达（`dist/service-broker.js` / `errors.js` / `utils.js` 均导出预期成员）。
- **回归**：`npm test` → 137 suites / 2360 passed / 4 skipped（与基线一致）；`npm run build` 通过。

### 9.7 迁移踩坑

**`prefer-const` 在 `.js` 下不报、改成 `.ts` 后开始报**（同 7.6）。`eslint dev --fix` 机械收敛后仅剩 `buffer.ts` 一处 `no-useless-assignment`（原写法 `let serializer` 声明后两分支都重新赋值），已改为直接初始化的 `const`，语义不变。此外 `--fix` 顺带把 `dev/` 全部脚本统一为 LF（内容无变化）。

---

## 十、需要的知悉项

1. **`strict` 仍为 `false`**（显式写死），后续可逐目录开启 `strictNullChecks` 等作为独立任务推进。
2. **本机 `npm run lint` 仍会报大量 `prettier Delete ␍`**：Windows 工作区 `core.autocrlf=true` 造成的既有现象，
   非 prettier 规则错误为 0；提交后仓库内容为 LF，Linux CI 不受影响。用
   `--rule '{"prettier/prettier":["error",{"endOfLine":"auto"}]}'` 复核时 `src` 为 0 error / 0 warning、`dev` 为 0 error / 3 warning（timing-attack 误报，非本次引入）。
3. **产物不再是「逐字节相同」**：`esModuleInterop` 会引入 `__importDefault` / `__importStar` 辅助调用。
   对象引用、`instanceof`、单例语义均不变（jest 2360 项断言与覆盖率与改造前一致可佐证）。
4. **测试工具链是升级 TS 6/7 的真正风险点**，而非语法：当前用 `ts-jest ^29`，
   6.0/7.0 支持取决于 ts-jest 是否跟进；长期可考虑 Node 原生类型剥离或 swc。
5. 调试时若用 `tsc xxx.ts` 单文件编译：TS 6.0 起目录内存在 tsconfig 时会报 `TS5112`，需加 `--ignoreConfig`。
6. **测试的运行器始终是 jest**：曾尝试迁移到 Node 原生 `node:test`，因缺少链式 `expect` API、
   `mock.module` 需实验标志且无 hoisting、快照格式不兼容而放弃；唯一沉淀是规格化的 helper 层（见第七章）。

---

## 十一、后续可选项

- 逐目录开启 `strict` / `strictNullChecks`，渐进清偿类型债
- 把 136 个 spec 逐步纳入类型门禁（当前只 gate `test/helpers/**`，见 7.5）
- `test/services/*.js` 5 个 fixture 若要 `.ts` 化，需同步改 `service-broker.spec.ts` 里的加载路径与文件名断言
- 把历史 `@ts-ignore`（15 处）逐步替换为真实类型修复
- `export =` → ESM 导出（会改变公共 `.d.ts` 形态，需同步 `index.d.ts` 与 tsd 用例）
- `test/e2e`（shell + docker 驱动）未调整，其内部使用发布包，无需改动
- `dev/` 的 A/B 两组（70 个 `.ts`）目前不在任何类型门禁内（无 tsconfig 覆盖），如需可新增 `tsconfig.dev.json` 并纳入 `test:tscheck` 同款流程
- `dev/` 的历史坏引用（`./RedisHeartbeat`、`./examples/*.service.js`、`require("moleculer")`、`../src/validator`）按本次口径只记录未修，可作为独立小任务清理
- 把 `ActionSchema` 拆成"输入 schema"与运行时 `Action`（`service: Service`、`rawName: string`、`handler` 必填）两个类型（见 4.15），可让 `Middleware.localAction` / `Context.action` 的语义更准；属公开类型调整，需同步 `index.d.ts`、tsd 用例与 catalog 的 `Omit<...>`
- 中间件内部的 `ctx` 仍是隐式 `any`（`ctx._retryAttempts`、`ctx.startHrTime`、`ctx.service.actions[action.rawName]` 等，见 4.15.1），收口需先给 `Context` 补内部字段或引入内部类型
