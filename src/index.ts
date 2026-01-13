import { Context, Schema } from 'koishi'

export const name = 'russian-roulette'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context, config: Config) {
  ctx.command("russian.help").action(async({session})=>
  {
    await session.send("俄罗斯轮盘帮助：\n开启游戏：装弹 [子弹数] ?[金额](默认200金币) ?[at](指定决斗对象，为空则所有群友都可接受决斗)\示例：装弹 1 10\n接受对决：接受对决/拒绝决斗\n开始对决：开枪 ?[子弹数](默认1)（轮流开枪，根据子弹数量连开N枪械，3分钟未开枪另一方可使用‘结算’命令结束对决并胜利）\n结算：结算（当某一方3分钟未开枪，可使用该命令强行结束对决并胜利）\n我的战绩：我的战绩\n排行榜：金币排行/胜场排行/败场排行/欧洲人排行/慈善家排行\n【注：同一时间群内只能有一场对决】");
    return null;
  })
}
