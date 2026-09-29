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

---

## 五、门禁验证（改造后全量运行）

| 门禁 | 结果 |
|---|---|
| `tsc -p tsconfig.json` | **0 error**（1.4s） |
| `tsc -p tsconfig.examples.json`（src + examples） | **0 error** |
| `npx jest` | **136 suites / 2346 passed / 4 skipped** |
| `npm run test`（含覆盖率） | 通过，All files **96.39%** |
| `npm run build` | 通过，`dist/` 与 `src` **1:1**（133 js + 133 d.ts + runner-esm.mjs） |
| `npm run test:ts`（build + tsd + hello-world 编译 + ts-node 运行） | 通过（tsd 0 error，示例服务正常启停） |
| `npm run test:esm` | 通过（3 个服务启动成功） |
| `npm run test:examples`（build + 示例类型检查） | 通过（4.5s） |
| ESLint `benchmark bin examples src test` | **0 error / 4 warning**（均为未使用变量；忽略行尾差异口径） |
| `tsx examples/client-server/server.ts` + `client.ts` | 通过：16 次 `math.add` 全部成功、3 次事件回声正常、0 报错 |
| `npm run demo simple` | 通过 |
| `require("./index.js")` / `import from "./index.mjs"` | 正常 |

---

## 六、基础设施改动清单

### `package.json`

| 项 | 说明 |
|---|---|
| `build` / `clean` / `prepublishOnly` | 新增；`prepublishOnly` 确保发布前一定构建 |
| `files` | `src` → `dist` |
| jest | 新增 `ts-jest` transform（`isolatedModules: true`，仅转译不做类型检查）；测试文件**全部未改** |
| `tsd.compilerOptions` | 增加 `esModuleInterop: true`（不影响 src 配置） |
| `dev` / `demo` / `bench` / `perf` / `memleak` | 改走 `tsx`，可直接解析 `.ts` |
| `demo:client-server:server` / `demo:client-server:client` | 新增，运行示例 |
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
  遗留 `@ts-ignore` 等按原状保留；`test / dev / benchmark / examples` 的 `.ts` 与 `.js` 共用放宽规则（允许 `console`）
- **CI**：`ci.yml` 增加 Build 与 `Type-check examples` 步骤；`publish.yml` 增加 Build 步骤

---

## 七、示例改造（`examples/client-server`）

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

---

## 八、需要的知悉项

1. **`strict` 仍为 `false`**（显式写死），后续可逐目录开启 `strictNullChecks` 等作为独立任务推进。
2. **本机 `npm run lint` 仍会报大量 `prettier Delete ␍`**：Windows 工作区 `core.autocrlf=true` 造成的既有现象，
   非 prettier 规则错误为 0；提交后仓库内容为 LF，Linux CI 不受影响。用
   `--rule '{"prettier/prettier":["error",{"endOfLine":"auto"}]}'` 复核时 `src` 为 0 error / 0 warning。
3. **产物不再是「逐字节相同」**：`esModuleInterop` 会引入 `__importDefault` / `__importStar` 辅助调用。
   对象引用、`instanceof`、单例语义均不变（jest 2346 项断言与覆盖率与改造前一致可佐证）。
4. **测试工具链是升级 TS 6/7 的真正风险点**，而非语法：当前用 `ts-jest ^29`，
   6.0/7.0 支持取决于 ts-jest 是否跟进；长期可考虑 Node 原生类型剥离或 swc。
5. 调试时若用 `tsc xxx.ts` 单文件编译：TS 6.0 起目录内存在 tsconfig 时会报 `TS5112`，需加 `--ignoreConfig`。

---

## 九、后续可选项

- 逐目录开启 `strict` / `strictNullChecks`，渐进清偿类型债
- 迁移 153 个测试文件到 TypeScript（当前保持 `.js` + `ts-jest`）
- 把历史 `@ts-ignore`（15 处）逐步替换为真实类型修复
- `export =` → ESM 导出（会改变公共 `.d.ts` 形态，需同步 `index.d.ts` 与 tsd 用例）
- `test/e2e`（shell + docker 驱动）未调整，其内部使用发布包，无需改动
