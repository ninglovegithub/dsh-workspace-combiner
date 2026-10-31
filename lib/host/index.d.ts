import { Context } from "@deepseek-ai/cordis";

//#region src/host/index.d.ts
/** 稳定的 cordis 插件名（编排行 id）。 */
declare const name = "dsh-workspace-combiner";
/** 宿主挂载前必须就绪的服务。 */
declare const inject: string[];
/** 插件配置（无 schema，apply 内做默认值处理）。 */
interface Config {
  /** 总开关；false 时不注册任何东西。 */
  enabled?: boolean;
  /** 是否向模型注入多工作区 prompt 分节（默认 true）。 */
  announceToAgent?: boolean;
}
declare function apply(ctx: Context, config?: Config): void;
//#endregion
export { Config, apply, inject, name };
//# sourceMappingURL=index.d.ts.map