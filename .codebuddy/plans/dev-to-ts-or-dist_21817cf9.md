---
name: dev-to-ts-or-dist
overview: 评估 dev/ 下 78 个开发试验脚本：把适合的一批（约 70 个，纯 CJS 脚本、无「按文件名字符串被加载」约束）用与 examples 相同的 codemod 转成 .ts 并保留对 ../src 的引用；不适合的一批（派发器 index.js、空 fixture、原生 JS 服务示范、cluster 父子进程体系、交互式 REPL、配置文件，共 8 个）保持 .js，并把其中的 ../src/* 引用改为 ../dist/*。最后跑 lint 静态/冒烟校验并更新 TS改造文档.md。
todos:
  - id: dev-a-convert
    content: 用 codemod 把 dev 的 A 组 33 个脚本转为 .ts 并删除同名 .js，逐个 tsx 冒烟与迁移前行为对比
    status: completed
  - id: dev-b-convert
    content: 把 dev 的 B 组 37 个脚本转为 .ts，做 esbuild 语法校验与 import 可达性校验
    status: completed
    dependencies:
      - dev-a-convert
  - id: dev-c-dist
    content: C 组 8 个保留 .js 的文件改造：client(2 处)、server(3 处)、jsrepl(1 处) 的 src 引改为 dist 并校验可达
    status: completed
    dependencies:
      - dev-b-convert
  - id: dev-lint
    content: 运行 eslint dev --fix 收敛 prefer-const 与格式问题，确保 eslint dev 零问题
    status: completed
    dependencies:
      - dev-c-dist
  - id: dev-docs
    content: 在 TS改造文档.md 新增 dev 章节：分组标准、数量清单、双引用策略与运行前置条件
    status: completed
    dependencies:
      - dev-lint
---

## 产品概述

评估 `dev/` 目录下 78 个开发期试验脚本，按「能否 TS 化」分成三批处理：适合的改为 TypeScript；不适合继续保持 `.js` 的，把其中对 `../src/*` 的依赖改成 `../dist/*`（构建产物）。

## 需求内容

1. **评估与分类**：逐文件判断哪些 dev 脚本适合改成 TS —— 判定依据为「是否可被任一不经过 TS 运行时的环境按文件名/路径加载」「是否纯粹用于演示原生 JS 语义」「是否能被本地验证」，而不是文件长度。
2. **适合的一批改 TS**：用与 `examples/` 相同的方式（codemod + 逐文件修类型）转换；转换后仍引用 `../src`（保留「改 src 立即生效」的开发语义），以 `tsx` 运行。
3. **不适合的一批保留 `.js`**：把其中的 `../src/*` 引用改为 `../dist/*`，运行时前置 `npm run build`。
4. **保住可运行性与门禁**：迁移后 dev 侧行为与迁移前一致，`eslint dev` 需清零。
5. **沉淀到 `TS改造文档.md`**：记录分组标准、数量、两组为何不同引用策略、以及运行方式差异。

## 一、技术栈（沿用现有，不引入新依赖）

| 项 | 选择 | 说明 |
|---|---|---|
| 运行方式 | `tsx`（`npm run dev` = `tsx watch dev/index.js`） | dev 的 `.ts` 只能由 tsx 运行，因此**转换后仍引用 `../src`**，与 `examples/*.ts` 一致 |
| 保留 `.js` 的运行方式 | 原生 `node`，前置 `npm run build` | 依赖 `dist/`（根 `index.js` 已指向 `./dist/*`，可为先例） |
| 静态校验 | 仓库已有 `esbuild`（tsx 依赖）+ `require`/`fs` 路径解析 | B 组无法实跑，用「语法 transform + import 目标可达」兜底 |
| lint | `eslint dev --fix`（沿用本轮统一口径 `--rule '{"prefer-const/prettier":["error",{"endOfLine":"auto"}]}'`） | dev 已在 `eslint.config.js` 末尾放宽块内（`no-console` / `no-unused-vars` / `@typescript-eslint/no-unused-vars` 均已关闭） |

## 二、实测盘点（只读核实）

- `dev/` = **78 个 `.js` + `nats-cert.pem`**，全部 CJS（`require` / `module.exports`），无 ESM/`.mjs`
- 对 src 的引用 **92 处**：`../src/service-broker` 64、`../src/errors` 10、`../src/utils` 9、`transit-logger` 2、`transmit/compression` 2、`context` / `middlewares` / `metrics/reporters` / `service` / `validator` 各 1
- `require("..")` 6 处、`require("../")` 7 处 —— 根 `index.js` 已指向 `./dist/*`，**无需改动**
- 陈旧坏引用（不在本次范围，仅记录）：`./RedisHeartbeat`（client/server，文件缺失）、`./examples/*.service.js`（base/es6-class/lifecycle，目录缺失）、`require("moleculer")`（包未安装）
- transporter 分布：**40 个**显式设远程传输器（NATS/Redis/TCP/kafka/amqp/AMQP10），本机跑不起来；**38 个**未设置

## 三、分类结论

### C 组：保持 `.js` + `src → dist`（8 个）

| 文件 | 保留理由 | src 引用 | 需改 |
|---|---|---|---|
| `index.js` | 动态派发器 `require("./" + name)`，`package.json` 的 `dev` 脚本写死 `dev/index.js` | 0 | 0 |
| `empty.service.js` | 空 fixture（内容为空） | 0 | 0 |
| `native-service.js` | 演示「原生 JS 服务定义」语义，转 TS 即失去示范意义 | 0 | 0 |
| `dev.config.js` | 运行时配置文件（可按路径加载），不应要求 tsx 才能解析 | 0 | 0 |
| `cluster.js` | `cluster` fork worker，worker 目标 `require("./client.js")` 是字符串加载 | 0 | 0 |
| `client.js` | cluster 体系成员 + 缺 `./RedisHeartbeat` + 多远程传输器 | 2（`service-broker`、`utils`） | 2 → `../dist/*` |
| `server.js` | 同 client.js | 3（`service-broker`、`errors`、`utils`） | 3 → `../dist/*` |
| `jsrepl.js` | 交互式 REPL（需 stdin），无法自动化验证 | 1（`service-broker`） | 1 → `../dist/*` |

### A 组：改 TS，可本地冒烟（33 个）

`action-hooks`、`async-local-storage`、`breaker`、`bulkhead`、`cache`、`caller`、`debounce-throttle`、`duplex-streaming`、`errorHandler`、`es6-class`、`event-store`、`event-validator`、`hook-wildcard`、`i18n-validator`、`internal-errors`、`internal`、`issue-1121`、`issue-1137`、`issue-1241`、`issue-1333`、`issue-546`、`logger`、`method-mw`、`mw-order`、`perf`、`retries`、`SafeJsonSerializer`、`saga`、`schema-custom-merge`、`serializer-register`、`timeout`、`validator-async`、`validator`
（第三方依赖：`winston`/`joi`/`dd-trace` 已安装；`observable-slim` 未安装，`issue-1137` 迁移前后行为一致即可）

### B 组：改 TS，但需外部 infra 无法实跑（37 个）

`base`、`bigfile-sender`、`bigfile.receiver`、`broadcast-groups`、`buffer`、`circular`、`compress`、`custom-context`、`dev`、`direct-call`、`encrypt`、`event-error`、`event-wildcard`、`gossip-viz`、`headers`、`inter-ns`、`issue-1100-receiver`、`issue-1100-sender`、`issue-1132`、`issue-777`、`lifecycle`、`loglevel`、`metrics`、`middleware_v2`、`nats-wildcard`、`remote-deps`、`sharding`、`shared-obj`、`stream-caller`、`stream-demo`、`stream-echo`、`stream-java`、`stream-obj`、`stream-receiver`、`stream-sender`、`tracing`、`tracking`

合计 33 + 37 + 8 = **78**，全部覆盖。

## 四、迁移形态映射（沿用 `examples/` 已验证先例）

| 原形态 | 转换结果 |
|---|---|
| `const ServiceBroker = require("../src/service-broker")` | `import ServiceBroker from "../src/service-broker"`（`export =` 类，interop 可用） |
| `const { X } = require("../src/errors")` / `../src/utils` | `import { X } from "../src/errors"` |
| `const { randomInt } = require("../src/utils")` | `import { randomInt } from "../src/utils"` |
| `require("../src/middlewares/debugging/transit-logger")` | `import mw from "../src/middlewares/debugging/transit-logger"` |
| `require("..")` / `require("../")` | **保持不变**（已指向 dist） |
| `module.exports = Schema` | `const Schema: ServiceSchema = {...}; export default Schema` |
| 类里构造函数动态挂字段 | 补字段声明（与 src 同处理） |

**跨文件引用同步**：`serializer-register` → `./SafeJsonSerializer`、`stream-sender` → `./stream-receiver` 两组同批转换（改为显式 import 或保留无后缀 require 后实测）；`cluster.js → ./client.js` 双方均留 `.js`，不动。

## 五、验证策略

| 组 | 门禁 | 期望 |
|---|---|---|
| A（33） | 迁移前后**行为对比**：转换前 `npx tsx dev/x.js`（统一 10s 超时）记录「退出码 + 输出尾部」基线；转换后 `npx tsx dev/x.ts` 比对。长期运行的 broker 脚本超时视为正常；立即退出的须退出码一致 | 无回归 |
| B（37） | 静态三层：① `esbuild.transform` 语法通过；② 每个相对 import/require 目标文件系统可达；③ `eslint dev` 0 problem | 无语法/引用错误 |
| C（8） | 先 `npm run build`；再脚本化校验每个改写的 `../dist/*` 目录在 `dist/` 下存在 | 引用可达 |
| 全量 | `npx eslint dev`（`endOfLine:auto` 口径） | **0 problem** |
| 回归 | `npm test`（不应被 dev 改动影响）、`npm run build` | 全绿 |

## 六、必须注意的踩坑（本轮实测）

同一份代码在 `.js` 下不触发 `prefer-const`，改成 `.ts` 后开始报 —— 本轮在 `test/` 侧已复现并处理（`eslint --fix` 机械修复 1407 处 + 4 处手工改写）。**dev 转 `.ts` 后必然复现**，因此 `eslint dev --fix` 是计划内的必经步骤，个别「`describe`/顶层 `let` → 后续赋值」写法需手工改为声明即初始化。

## 七、目录结构

```
dev/
├── *.ts                    # [NEW] A(33) + B(37) 转换产物，run: npx tsx dev/x.ts，仍引用 ../src
├── *.js                    # [DELETE] 对应的同名 .js
├── index.js                # [KEEP] 动态派发器（.ts 也能被 tsx 解析）
├── empty.service.js        # [KEEP] 空 fixture
├── native-service.js       # [KEEP] 原生 JS 服务示范
├── dev.config.js           # [KEEP] 配置文件
├── cluster.js / client.js / server.js  # [KEEP] cluster 体系；client(2)/server(3) 处 src→dist
├── jsrepl.js               # [KEEP] 交互式 REPL；1 处 src→dist
└── nats-cert.pem           # [KEEP]
TS改造文档.md                # [MODIFY] 新增 dev 章节（分组标准/数量/双引用策略/需要先 build）
```

## 八、风险与缓解

| 风险 | 缓解 |
|---|---|
| B 组无法实跑，转换引入隐蔽错误 | 语法 + import 可达 + lint 三层静态校验；形态与 A 组完全同构（同 codemod），出错面受控 |
| `--fix` 把 `let` 改成 `const` 改变语义 | `prefer-const` 只在「声明即初始化且从未重新赋值」时修正，语义等价；A 组逐文件冒烟兜底 |
| C 组指向 dist 后「忘了 build」 | 文档明示运行前置 `npm run build`，并在 `TS改造文档.md` 记录这批文件清单 |
| 陈旧坏引用干扰判断 | `./RedisHeartbeat`、`./examples/*.js`、`require("moleculer")` 保持原状并仅记录，不纳入本次修复 |
