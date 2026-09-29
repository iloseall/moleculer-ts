# Moleculer TypeScript 原生化改造文档

> 目标：把「JS 实现 + 同目录手写 `.d.ts`」的双文件结构，改造成 **TypeScript 原生单文件源码**（`src/**/*.ts`），
> 由 `tsc` 构建出 `dist/**/*.js` + `*.d.ts`，并保持运行时行为逐字节等价、公共类型 API 不丢失。

---

## 一、最终状态

```
src/          133 个 .ts（原 133 个 .js + 115 个手写 .d.ts 全部合并删除）+ 1 个 runner-esm.mjs
dist/         133 个 .js + 133 个 .d.ts + runner-esm.mjs（与 src 严格 1:1）
```

- 源文件删除：248 个（133 个 `.js` + 115 个 `.d.ts`）
- `src` 下残留 `.js` / `.d.ts`：**0**
- `dist/` 已被 `.gitignore` 忽略，通过 `npm run build` 生成，并在 CI / 发布流程中前置执行

---

## 二、门禁验证（最后一次全量运行）

| 门禁 | 结果 |
|---|---|
| `npx tsc` | **0 error** |
| `npx jest` | **136 suites / 2346 passed / 4 skipped** |
| `npm run test`（覆盖率） | 通过，All files **96.4%**（基线 96.26%） |
| `npm run test:ts`（build + tsd + hello-world 编译 + ts-node 运行） | 通过 |
| `npm run test:esm` | 通过 |
| ESLint `src`（忽略行尾差异） | **0 error / 0 warning** |
| `require("./index.js")` / `import from "./index.mjs"` | 正常 |
| `dist` 完整性 | 与 src 1:1，无遗留/缺失 |

---

## 三、改造过程中解决的关键问题

### 1. 泛型方法签名丢失

旧 `.d.ts` 里 `call` / `mcall` / `emit` / `broadcast` / `broadcastLocal` / `callWithoutBalancer` / `createService`
都是**多行泛型重载**，机械合并时被丢掉，导致 `test/typescript/hello-world` 报
`Expected 0 type arguments, but got 3`。

已按原语义还原为单条泛型签名（示例）：

```ts
createService<
    TSettings = ServiceSettingSchema,
    TMethods = Record<string, any>,
    TVars = Record<string, any>,
    TThis = Service<TSettings> & TVars & TMethods
>(schema: any, schemaMods?: any): TThis
```

### 2. `Cachers.Memory` 的「值 + 类型」双重身份

- 单测要求 `Cachers.register("X", …)` 后 `Cachers.X` 可读 → 需要 `export =` 一个**可变对象**
- tsd 要求 `Cachers.Memory` 可作**类型**使用 → 需要具名导出

最终形态为「`const Cachers` + `declare namespace Cachers { type Memory = MemoryCacher … }` + `export = Cachers`」，
这是唯一能同时满足运行时可变性与类型可用性的写法。

```ts
const Cachers: { Base: typeof BaseCacher; Memory: typeof MemoryCacher; /* … */ [key: string]: any } = { /* … */ };

declare namespace Cachers {
    export type Memory = MemoryCacher;
    // …
}

export = Cachers;
```

### 3. 中间件 `this` 上下文（`TS2684`）

`ActionHandler<Service>` 中的 `Service` 若用 `import type Service = require("./service")`，会触发：

```
TS2684: The 'this' context of type 'void' is not assignable to
        method's 'this' of type ...<ServiceSettingSchema>
```

改为 `import type Service from "./service"`，并在 `tsconfig.json` 增加 `allowSyntheticDefaultImports: true`
（**纯类型开关、无运行时影响**），即恢复与旧手写 `.d.ts` 完全一致的类型体验。

### 4. JSDoc 类型断言在 `.ts` 中失效

`/** @type {X} */ (expr)` 只在 JS 文件中生效，`.ts` 中一律替换为真正的 `as X`
（涉及 `net.AddressInfo`、`ServiceSchema`、`ActionSchema` 等若干处）。

### 5. 类型守卫的隐式谓词

`isPlainObject(x)` / `isString(x)` 等会让 TS 把 `any` 收窄为 `object` / `string | String`，
在若干调用点补 `as any` 或放宽形参类型（代码中已加注释说明原因）。

### 6. `Promise<void>` 与内部 `Promise<boolean>` 冲突

`emit` / `broadcast` / `broadcastLocal` 对外保持公开 `Promise<void>` 签名，
内部中间量声明为 `any`，运行时零改动。

### 7. 顺手修复一个隐藏 bug

`src/transporters/tcp/udp-broadcaster.js` 原为 `require("../../../src/utils")`（自引用源码树），
在 `dist` 下会解析回 `src/`，直接导致 `npm run test:esm` 崩溃；已改为 `require("../../utils")`。

### 8. 清理工作

- 删除 67 处机械迁移遗留的无用导入（`import type X = require(...)` 等）
- `prefer-const` 修正
- prettier 格式化归一（`endOfLine: auto` 口径下 src 为 0 error / 0 warning）

---

## 四、基础设施改动清单

### `tsconfig.json`（检查用，`noEmit`）

```jsonc
{
    "compilerOptions": {
        "module": "commonjs",
        "target": "ES2022",
        "useDefineForClassFields": false,   // 关键：保持 ES2021 类字段赋值语义
        "esModuleInterop": false,           // 配合 import X = require()
        "allowSyntheticDefaultImports": true, // 纯类型开关
        "strict": false,                    // 先迁移、后收紧
        "skipLibCheck": true
    },
    "include": ["types/extends.d.ts", "src/**/*.ts"]
}
```

> **`useDefineForClassFields: false` 是本次改造最关键的一项**：`target: ES2022` 默认 `true`，
> 会把类字段改成 `Object.defineProperty` 语义，子类字段会**覆盖**父类/构造期赋值，属于静默行为变更。

### `tsconfig.build.json`（新增，产出 `dist/`）

`rootDir: src` → `outDir: dist`，`declaration + declarationMap + sourceMap`。

### `package.json`

| 项 | 说明 |
|---|---|
| `build` / `clean` / `prepublishOnly` | 新增；`prepublishOnly` 确保发布前一定构建 |
| `files` | `src` → `dist` |
| jest | 新增 `ts-jest` transform（`isolatedModules: true`，仅转译不做类型检查）；测试文件**全部未改** |
| `tsd.compilerOptions` | 增加 `esModuleInterop: true`（不影响 src 配置） |
| `dev` / `demo` / `bench` / `perf` / `memleak` | 改走 `tsx`，可直接解析 `.ts` |
| `test:ts` / `test:esm` | 前置 `npm run build` |

### 入口与路径

- `index.js`、`index.d.ts`、`index.mjs`、`bin/moleculer-runner.mjs`：`./src/...` → `./dist/...`
- `test/typescript/hello-world/greeter.service.ts`：模块增强路径 `../../../src/service` → `../../../dist/service`

### 工程配置

- **ESLint**：接入 `typescript-eslint`，为 `**/*.ts` 增加规则块；CJS 的 `import =`/`export =`、`any`、
  `declare namespace`、遗留 `@ts-ignore` 等按原状保留
- **CI**：`ci.yml` 与 `publish.yml` 增加 Build 步骤

---

## 五、需要的知悉项

1. **`strict` 仍为 `false`**（按约定先迁移后收紧）。后续可逐目录开启 `strictNullChecks` 等，作为独立任务推进。
2. **本机 `npm run lint` 仍会报大量 `prettier Delete ␍`**：这是 Windows 工作区 `core.autocrlf=true` 造成的
   既有现象（基线同样是 3 万+ 条，且**非 prettier 规则错误为 0**）；提交后仓库内容为 LF，Linux CI 不受影响。
   用 `--rule '{"prettier/prettier":["error",{"endOfLine":"auto"}]}'` 复核时 `src` 为 0 error / 0 warning。
3. **模块语法统一为 `export =`**（`import X = require("y")`）：编译产物是纯 `module.exports = X`，
   不注入 `__esModule`，与迁移前运行时行为完全一致，既有的 `instanceof` 类断言不受影响。

---

## 六、后续可选项

- 逐目录开启 `strict` / `strictNullChecks`，渐进清偿类型债
- 迁移 153 个测试文件到 TypeScript（当前保持 `.js` + `ts-jest`）
- 把 67 处历史 `@ts-ignore` 逐步替换为真实类型修复
- `test/e2e`（shell + docker 驱动）暂未调整，其内部使用发布包，无需改动
