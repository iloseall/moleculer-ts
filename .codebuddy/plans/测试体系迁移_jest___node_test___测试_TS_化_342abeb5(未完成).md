---
name: 测试体系迁移：jest → node:test + 测试 TS 化
overview: 把 136 个 jest 测试文件（57k 行）迁移到 node:test 原生测试框架，迁移过程中将适合的测试 TS 化，并用「Node 原生 test runner + tsx 加载器」直接运行 .ts 测试。已实测确认 node 直接跑 src/*.ts 不可行（export = 与 CJS 包内 ESM import 语法），采用 tsx 加载器方案替代。
todos:
  - id: infra
    content: 搭建基础设施：test/helpers/expect.ts 兼容层（expect.any/ objectContaining/ mock 断言/toBeAnyOf）+ scripts/run-tests.mjs + package.json 增加 test:node 脚本与 c8，jest 双轨保留
    status: completed
  - id: pilot
    content: 试点迁移 5 个无 jest.mock/快照/假定时器的 spec（errors/packets/health/utils/context）为 node:test + TS 并验证
    status: completed
    dependencies:
      - infra
  - id: batch-common
    content: codemod 批量迁移其余普通 spec（unit 剩余 + integration，describe/it/jest.fn/jest.spyOn → test/mock.fn/mock.method），逐目录跑绿
    status: completed
    dependencies:
      - pilot
  - id: fake-timers
    content: 迁移 9 个假定时器文件：useFakeTimers/advanceTimersByTime/setSystemTime → mock.timers，逐个核对调用次数断言
    status: completed
    dependencies:
      - batch-common
  - id: module-mocks
    content: 迁移 30 个 jest.mock 文件：启用 --experimental-test-module-mocks，mock.module 改写 + 调整 import 顺序（无 hoisting），transporters/loggers/discoverers 逐文件验证
    status: completed
    dependencies:
      - batch-common
  - id: snapshots
    content: 迁移 5 个 __snapshots__ 目录：t.assert.snapshot + --test-update-snapshots 重新生成，人工 diff 审阅 31 处快照内容
    status: in_progress
    dependencies:
      - batch-common
  - id: finalize
    content: 移除 jest/ts-jest 依赖与配置，test 脚本收敛为 node --import tsx --test + c8，更新 ci.yml 与 TS改造文档，全量门禁（2346 项 + 覆盖率 ≥96.39% + 22/24 双版本）收尾
    status: pending
    dependencies:
      - fake-timers
      - module-mocks
      - snapshots
---

## 需求分析

用户提出三项测试体系改造需求，并要求先论证可行性：

1. **用 node:test 替代 jest**：将 `test/unit`（26 项）+ `test/integration`（16 个）共 136 个 spec 文件 / 57,180 行测试从 jest 迁移到 Node 原生 `node:test` runner
2. **部分适用的测试改成 TS**：将迁移的 spec 文件从 `.js` 改写为 `.ts`（沿用项目「TS 原生化」的整体方向）
3. **用 node 直接运行 TS**：期望不依赖 jest/ts-jest 的转译链路直接运行 TypeScript 测试

## 可行性结论（已实测验证）

| 需求 | 结论 | 依据 |
|---|---|---|
| node:test 替代 jest | **可行，但需兼容层** | `node:test` 已具备 describe/it/before*/mock.fn/mock.method/mock.timers/snapshot；但**无链式 expect API**（仅 assert.*）、无 expect.any 等不对称 matcher、`mock.module` 需 `--experimental-test-module-mocks` 标志（无标志时为 undefined，已实测） |
| 测试改 TS | **可行** | 项目已全面 TS 化，ts-jest 已在转译 `.ts`；迁移后由 tsx loader 承担 |
| node 直接运行 TS | **原生不可行，采用替代方案** | 两条根因均已在仓库实测复现：① `export = ServiceBroker` 是不可擦除语法，type stripping 直接报错；② package.json 无 `type: "module"` 时 `.ts` 按 CJS 处理，而 Node 不做模块语法转换（ESM import + CJS 包 + export = 组合无法运行）。**替代**：`node --import tsx --test`（Node 原生 runner + tsx loader，仓库 demo/dev 链路已验证 tsx 可行） |

## 约束与边界

- 不改动 `src/` 运行时代码；不改变测试语义（断言行为、覆盖基线 96.39%）
- `test/typescript/`（tsd + hello-world）、`test/e2e`（docker）、`test/esm`（runner）、`test/leak-detection`（.spc.js）**不在迁移范围**
- 迁移期间 jest 与 node:test 双轨并行，全量迁移完成后移除 jest/ts-jest


## 技术方案

### 一、总体策略

**双轨渐进迁移**：先搭建 node:test 基础设施与 expect 兼容层，试点验证后按「文件特性」分批迁移（普通 → 假定时器 → 模块 mock → 快照），jest 保留至全部迁完再移除。这样每一步都有完整的 2346 项测试基线可对照，避免一次性大爆炸式重写。

```mermaid
flowchart LR
    A[现状: jest + ts-jest] --> B[基础设施: expect 兼容层 + tsx loader + c8]
    B --> C[试点 5 个简单 spec]
    C --> D[批量迁移普通 spec]
    D --> E[假定时器 9 个文件]
    E --> F[jest.mock 30 个文件]
    F --> G[快照 5 目录重新生成]
    G --> H[移除 jest 收敛单轨 + CI/文档]
```

### 二、三个关键技术决策

**1. expect 兼容层（`test/helpers/expect.ts`，~300 行）**

现有 6800+ 处链式断言（`toHaveBeenCalledTimes` 1899、`toHaveBeenCalledWith` 1081、`toBeInstanceOf` 444、`expect.any(` 335、`toThrow` 85 等）直改为 `assert.*` 不可控。方案：实现一个 jest 风格的 `expect(received)` 链式包装：

- 底层用 `node:assert` 的 `deepStrictEqual` / `strictEqual` / `throws` 等
- 自实现不对称 matcher：`expect.any(Type)`、`expect.objectContaining()`、`expect.arrayContaining()`、`expect.stringContaining()`（在 deepEqual 比较时递归展开）
- mock 断言：读取 tsx/node:test `mock.fn` 的 `.mock.calls` 实现 `toHaveBeenCalledTimes / toHaveBeenCalledWith / toHaveBeenCalled`
- 迁移 `test/unit/utils.js` 的 `toBeAnyOf` 自定义 matcher 与 `protectReject` 助手

**2. mock 体系映射**

| jest 用法 | node:test 替代 | 迁移点 |
|---|---|---|
| `jest.fn()` / `jest.fn(impl)` | `mock.fn(undefined, impl)` | 机械替换（1899 处，codemod） |
| `jest.spyOn(obj, "m")` | `mock.method(obj, "m")` | 机械替换（134 处） |
| `jest.useFakeTimers()` / `advanceTimersByTime` / `setSystemTime` | `mock.timers.enable()` / `tick()` / `mock.timers.setDate()` | 语义对照需注意：jest 默认 mock 全局 timer，node:test 需显式 `enable({ now })`；`setSystemTime` 无直接等价，用 `setDate` |
| `jest.mock("pkg", factory)` | `mock.module("pkg", { namedExports/defaultExport })` | **最复杂**：需 `--experimental-test-module-mocks` 标志；**没有 hoisting**，mock 必须写在 import 被消费之前（CJS require 场景需把顶部 require 改为惰性或在 mock 之后动态 import）；30 个文件逐个处理 |

**3. 运行与覆盖率**

- 运行：`node --import tsx --test "test/unit/**/*.spec.ts" "test/integration/**/*.spec.ts"`（显式 glob；Windows 下用 Node 的 glob 支持，实测需注意 cmd 引号转义，必要时写成 JS 驱动脚本）
- 快照：`t.assert.snapshot(value)` + 生成期 `--test-update-snapshots`，与 jest `__snapshots__` 格式不兼容，**重新生成后必须人工 diff 审阅**（31 处、5 个目录，量可控）
- 覆盖率：jest `--coverage` → **c8**（V8 原生覆盖率，与 runner 解耦），`--exclude` 对齐现有 `coveragePathIgnorePatterns`，阈值锚定现有基线 96.39%（`--check-coverage`）
- 移除 `--forceExit` 依赖：node:test 下用 `--test-force-exit` 或逐个修复未关闭的句柄（迁移中记录泄漏文件，优先修复而非压制）

### 三、目录结构

```
test/
├── helpers/                        # [NEW] 测试基础设施
│   ├── expect.ts                   # jest 风格 expect 兼容层（链式 API + 不对称 matcher + mock 断言）
│   ├── mock.ts                     # jest.fn/jest.spyOn/jest.useFakeTimers 的简写适配（可选，若 expect 层不够用）
│   └── utils.ts                    # [由 test/unit/utils.js 迁入] protectReject + toBeAnyOf 注册
├── unit/                           # 26 项 → *.spec.ts（node:test 语法）
├── integration/                    # 16 个 → *.spec.ts
├── unit/__factories/               # 随迁移改 .ts（ServiceBroker 工厂等）
└── （typescript / e2e / esm / leak-detection 不动）

package.json                        # [MODIFY] test:node 脚本、c8、双轨期保留 jest、末期删除 jest 段与依赖
.github/workflows/ci.yml            # [MODIFY] test 步骤替换为 node --import tsx --test + c8；Node 22/24 matrix 下验证标志兼容
TS改造文档.md                       # [MODIFY] 新增「测试体系迁移」章节
```

### 四、风险与缓解

| 风险 | 缓解 |
|---|---|
| `--experimental-test-module-mocks` 标志未来 API 变动 | 集中封装在 helpers；CI 22.x + 24.x 双版本验证；该阶段放最后，若标志不可用可回退「仅这 30 个文件保留桩注入重构」（把可选依赖注入点改为构造参数） |
| 快照重新生成导致隐性断言丢失 | 生成后逐文件 git diff 人工审阅，确认快照内容与旧值语义一致 |
| 假定时器语义差异（jest 全局劫持 vs node:test 显式） | 9 个文件单独一个阶段，每个迁移后单独跑并核对调用次数断言 |
| Windows glob / cmd 转义 | 运行命令封装为 `scripts/run-tests.mjs`（Node 驱动，规避 shell 差异） |
| 覆盖率口径漂移 | c8 exclude 列表逐项对齐 jest coveragePathIgnorePatterns；迁移前后对比 All files 行覆盖率 |

### 五、验证门禁（每阶段必跑）

- `node --import tsx --test`（已迁文件）全绿
- `npx jest`（未迁文件，双轨期）全绿，总量 2346 基线不丢
- `c8 --check-coverage` 覆盖率不低于 96.39% 基线
- CI matrix（22.x / 24.x）双版本通过

