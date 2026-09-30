---
name: test-to-ts-on-jest
overview: 停止 node:test 迁移，回收为其引入的兼容层与脚本，保留 jest+ts-jest 作为唯一测试运行器，并把 unit/integration 的 136 个 spec（已迁移为 .ts）及剩余测试侧 .js 文件收敛为 TypeScript，最后跑通全量门禁并更新文档。
todos:
  - id: cleanup-node-test
    content: 删除 node:test 残留：scripts/ 目录、根目录垃圾文件 k+ 与 last、回退 eslint.config.js、移除 c8 依赖并同步 package-lock、改写 tsconfig.test.json 注释
    status: completed
  - id: convert-leftover-js
    content: 处理剩余测试侧 js：__factories 三个文件转 ts，删除已无引用的 unit/utils.js 与 integration/helpers.js 并同步 coveragePathIgnorePatterns，保留 services fixture 为 js
    status: completed
    dependencies:
      - cleanup-node-test
  - id: update-docs
    content: 更新 TS改造文档.md：门禁数据改为 137 suites/2360 passed/4 pending，新增测试 TS 化章节与 helper 使用约定，修正 jest transform 描述
    status: completed
    dependencies:
      - convert-leftover-js
  - id: verify-gates
    content: 跑全量门禁：npx jest 全绿、npm test 覆盖率不低于 96.39%、test:tscheck 通过、eslint test 通过、npm run build 通过
    status: completed
    dependencies:
      - update-docs
---

## 产品概述

本仓库当前处于「src/examples 已完成 TS 化」之后、测试体系改造进行到一半的状态。用户重新定标：**不再引入 node:test，继续以 jest + ts-jest 作为唯一测试运行器**，并把 unit/integration 的测试文件尽可能改成 TypeScript。

## 需求内容

1. **去 node:test 化**：删除/回退所有为 node:test 引入的助手函数与基础设施（`test/helpers/*` 的自研 expect 层与 mock 层、require.cache 改写、`scripts/run-tests.mjs`、`.c8rc.json`、`*.spec.ts.snapshot`、`c8` 依赖、`--experimental-test-module-mocks` 依赖），让整套测试回到纯 jest 语义。
2. **继续 TS 化**：已完成 136 个 spec 的 `.js → .ts` 迁移；剩余把测试侧的 `.js` 非 spec 文件（helper、factory、fixture）按可行性转为 `.ts`，明确指出哪些保持 `.js` 并说明理由。
3. **保住测试资产**：测试数量与断言语义不得丢失，覆盖率基线（96.39%）不得下降。

## 方案取舍评估（用户要求的核心）

| 方案 | 内容 | 评估 |
|---|---|---|
| **A. 基于现状修改（推荐）** | 保留 136 个已迁移 `.spec.ts`，仅清理 node:test 残留 + 处理剩余 `.js` + 文档 | 现状**已经全绿**：`npx jest` = **137 suites / 2360 passed / 0 failed / 4 pending**；helper 层已回退到 jest；逐文件比对 HEAD 与现 `.ts` 的 `it(` 计数 **2353 = 2353**、`protectReject` 引用数一致，**零测试丢失**。剩余工作量约 1 个收尾阶段 |
| **B. 放弃未提交改动重做** | `git checkout` 还原 package.json/eslint/package-lock，`git restore` 还原 151 个删除文件，删除 157 个未跟踪文件，再用 codemod 重跑 136 个文件的 JS→TS 迁移 | 等于重做已验证通过的全部迁移工作（数小时），且会丢失本轮积累的 4 个关键修复（before/after 映射、mqtt `interopDefault` 陷阱、`toBeAnyOf` 数组签名、`testMatch` 收敛）；历史「干净」带来的收益远小于风险 |

**结论：采用方案 A。** 唯一需要额外付出的，是把 node:test 时代的痕迹清理干净，这属于可控的小范围收尾。


## 一、技术栈（沿用现有，不新增）

| 项 | 选择 | 说明 |
|---|---|---|
| 测试运行器 | **jest 29.7** | 唯一运行器，`.github/workflows/ci.yml` 未被改动，继续跑 `npm test` |
| TS 转译 | **ts-jest 29.4**（`diagnostics: false`） | 新增 `tsconfig.jest.json`（`module: commonjs`、`moduleResolution: node`、`isolatedModules: true`、`esModuleInterop: true`），既消除 “isolatedModules 选项废弃” 告警，又不动 `src` 构建配置 |
| 帮助层 | `test/helpers/{test,expect,module-mock,utils}.ts` | 从 `@jest/globals` 转发，spec 不直接碰全局，便于将来换运行器 |
| mock | jest 原生 `jest.fn / jest.spyOn / jest.mock / jest.createMockFromModule / jest.requireActual` | 自研 automock 代码删除 |
| 假定时器 | jest 原生 `useFakeTimers / advanceTimersByTime / runAllTimers / setSystemTime / getTimerCount` | 由 `mock.*` 门面统一暴露 |

## 二、实施要点（踩坑已沉淀，执行时必须遵守）

1. **`before/after` 必须映射为 `beforeAll/afterAll`**（jest 没有 `before`/`after` 名字，否则报 `TypeError: (0 , test_1.before) is not a function`）。
2. **延迟 require 规则**：需要 mock 的模块，`require()` 必须写在 `autoMock(require.resolve("x"))` **之后**（jest.mock 无 hoisting 到 helper 调用点的能力，这条规则在两个 runner 下都成立，现 68 个文件已按此实现）。
3. **`interopDefault` 陷阱**：当 SUT 内部是 `require("pkg")` 而非 ESM import 时（如 `src/transporters/mqtt.ts`），spec 侧不能用 `interopDefault(require("pkg"))` —— jest automock 下 `mod.default` 与顶层成员是**两个不同 mock**，补丁必须打在模块导出本身。此坑已在 mqtt 上修过，处理其他 transporter/logger/cacher 时若出现「服务调用到 automock 返回 undefined」现象按同一思路排查。
4. **`expect`**：直接用 jest 原生 expect（`helpers/expect.ts` 仅做 `extendExpect` 注册 `toBeAnyOf` 后默认导出）；因此 `toBeAnyOf` 接受**数组**、恢复 spy 用 `spy.mockRestore()`（`mock.restore` 在 jest 的 mock context 上不存在）。
5. **`import * as ns` 可写性**：ts-jest 下 `__importStar` 因 `__esModule` 返回真实 exports 对象，`ns.fn = mock.fn()` 与 `mock.method(ns, "fn")` 均可用，无需 require.cache hack。

## 三、清理与改造清单

### 3.1 删除 node:test 残留
- `scripts/migrate-spec.mjs`（迁移 codemod，使命完成，连带 `scripts/` 目录）
- 根目录未跟踪垃圾文件：`k+'`、`last`
- `package.json`：移除 `c8` devDependency；`npm install --package-lock-only` 同步 lock
- `eslint.config.js`：回退为 HEAD 版本（其唯一净改动是为已删除的 `run-tests.mjs` 加的 `scripts/**` glob）
- `tsconfig.test.json`：改写头部注释（现写 “Type gate for the node:test infrastructure / executed through tsx”），改为「helpers 类型门禁」，保留 include：`types/extends.d.ts + src/**/*.ts + test/helpers/**/*.ts`（136 个 spec 故意不进门，因其含刻意的类型违规用例）

### 3.2 剩余测试侧 `.js` 文件处理（均已双重核实 **0 引用**）
- **转 `.ts`**：`test/unit/__factories/{my-service-factory, my-context-factory, my.service}.js`（合计约 28 行，直接改成 ES import/export 或 `export =`）
- **删除**：`test/unit/utils.js`（38 行，内容已被 `test/helpers/utils.ts` 的 `extendExpect` + `protectReject` 取代）、`test/integration/helpers.js`（54 行，导出 `H`，迁移后 spec 已内联所需逻辑）；同步移除 jest `coveragePathIgnorePatterns` 里的 `/test/unit/utils.js`
- **保持 `.js`（明确不转，写进文档理由）**：`test/services/*.js` 5 个服务 fixture —— 被 `test/unit/service-broker.spec.ts` 以**文件名字符串**加载（`broker.loadService("./test/services/math.service.js")`），断言写死 `path.normalize("test/services/users.service.js")`，且有「重复加载应 throw」用例；转 TS 会改变加载语义与断言
- **不改造范围**：`test/e2e/*`（docker）、`test/esm/*`（runner）、`test/leak-detection/*.spc.js`、`test/typescript/hello-world/out/*`（生成物）

### 3.3 配置最终形态
```jsonc
// package.json
"test": "jest --coverage --forceExit",
"test:unit": "jest --testMatch \"**/unit/**/*.spec.ts\" --coverage",
"test:int":  "jest --testMatch \"**/integration/**/*.spec.ts\" --coverage",
"test:tscheck": "tsc -p tsconfig.test.json",
"jest": {
  "testMatch": ["**/*.spec.ts", "**/*.spec.js"],
  "transform": { "^.+\\.tsx?$": ["ts-jest", { "diagnostics": false, "tsconfig": "<rootDir>/../tsconfig.jest.json" }] }
}
```

## 四、目录结构

```
test/
├── helpers/
│   ├── test.ts           # [MODIFY→已改] jest 门面：describe/it/before(=beforeAll)/mock
│   ├── expect.ts         # [MODIFY→已改] 包装 jest expect + extendExpect
│   ├── module-mock.ts    # [MODIFY→已改] jest.mock / createMockFromModule / requireActual / interopDefault
│   ├── utils.ts          # [保留] protectReject + extendExpect(toBeAnyOf)
│   └── expect.spec.ts    # [MODIFY→已改] 帮助层自测（14 项）
├── unit/**/*.spec.ts      # [已完成] 120 个
├── integration/*.spec.ts  # [已完成] 16 个
├── unit/__factories/*     # [MODIFY] .js → .ts
├── unit/utils.js          # [DELETE] 已被 helpers/utils.ts 取代
├── integration/helpers.js # [DELETE] 已无引用
├── services/*.js          # [保持 .js] 文件名被 service-broker.spec 断言写死
└── __snapshots__/*.spec.ts.snap  # [已完成] 15 个
根：scripts/、k+'、last → [DELETE]；tsconfig.jest.json [保留]；tsconfig.test.json [注释改写]
TS改造文档.md             # [MODIFY] 门禁数据 + 新增「测试 TS 化」章节 + helper 使用约定
```

## 五、验证门禁（收尾必跑）

| 门禁 | 期望 |
|---|---|
| `npx jest` | **137 suites / 2360 passed / 0 failed / 4 pending**（4 个 pending 为原有 `describe.skip`/`it.skip`） |
| `npm test`（`jest --coverage --forceExit`） | 通过，覆盖率不低于既有基线 **96.39%** |
| `npm run test:tscheck` | 通过（helpers 类型门禁 0 error） |
| `npx eslint test` | 0 error（或仅保留迁移前既有 warning） |
| `npm run build` | 通过（确保 src 未受影响） |

## 六、风险与缓解

| 风险 | 缓解 |
|---|---|
| 删除 `unit/utils.js` / `integration/helpers.js` 后才发现仍有引用 | 执行前用 lint（`--report-unused-disable-directives` 无用）+ 全仓库 search 二次核实；ero 若命中则改为转 `.ts` 保留 |
| 覆盖率因 spec 重命名为 `.ts` 而口径漂移 | `coveragePathIgnorePatterns` 同步更新后重跑全文覆盖率，与 96.39% 对比，下降则排查是否 spec 未被收集 |
| 其他 transporter/logger/cacher 潜藏与 mqtt 同类的 `interopDefault` 陷阱 | 全量 jest 已绿；若后续调整 mock 写法，按第四节要点 3 排查 |

