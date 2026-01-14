import { Context, Schema } from 'koishi'
declare module 'koishi' {
  interface Tables {
    russiandata:usergold
  }
}

export const name = 'russian-roulette'
export const inject = ['database']
export interface Config {
  daylygold:number
}
export interface usergold {
  id: string
  time: Date
  gold:number
}

export const Config: Schema<Config> = Schema.object({
  daylygold: Schema.number().default(100).description('每日获得最多金币量')
})
function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
export function apply(ctx: Context, config: Config) {
  ctx.model.extend('russiandata', {
    // 各字段的类型声明
    id: 'string',
    time: 'timestamp',
    gold: 'unsigned'
  })
  ctx.command("russian.help","俄罗斯轮盘帮助").alias('俄罗斯轮盘帮助').action(async({session})=>
  {
    await session.send("俄罗斯轮盘帮助：\n开启游戏：装弹 [子弹数] ?[金额](默认200金币) ?[at](指定决斗对象，为空则所有群友都可接受决斗)\示例：装弹 1 10\n接受对决：接受对决/拒绝决斗\n开始对决：开枪 ?[子弹数](默认1)（轮流开枪，根据子弹数量连开N枪械，分钟未开枪另一方可使用‘结算’命令结束对决并胜利）\n结算：结算（当某一方3分钟未开枪，可使用该命令强行结束对决并胜利）\n我的战绩：我的战绩\n排行榜：金币排行/胜场排行/败场排行/欧洲人排行/慈善家排行\n【注：同一时间群内只能有一场对决】");
    return null;
  });
  ctx.command("russian.dayly","每日签到").alias('轮盘签到').action(async ({session})=>  // 添加 async
  {
    let addcoin=getRandomInt(config.daylygold)+1;  // 使用小写 config
    const userId = session.userId
    const channelId = session.channelId
    const uniqueId = `${userId}:${channelId}`
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 使用 await 等待数据库查询结果
    const users = await ctx.database.get('russiandata', {id: uniqueId})
    let usernow

    if(!users || users.length === 0)
    {
      usernow = {
        id: uniqueId,
        gold: -100
      }
    }
    else
    {
      usernow = users[0]
    }

    // 检查 usernow 是否存在，然后检查时间
    if(usernow && (usernow.gold === -100 || !usernow.time || new Date(usernow.time).getTime() < today.getTime()))
    {
      if(usernow.gold === -100)
      {
        usernow.gold = 100;
      }
      usernow.time = today;
      usernow.gold += addcoin;

      // 保存到数据库
      // if(users && users.length > 0) {
      //   await ctx.database.set('russiandata', {id: uniqueId}, usernow)
      // } else {
      //   await ctx.database.create('russiandata', usernow)
      // }
      users[0]=usernow;
      ctx.database.upsert('russiandata',users);
      if(getRandomInt(2) === 1)
      {
        return `这是今天的钱，祝你好运...\n你获得了${addcoin}金币!`
      }
      else
      {
        return `今天可别输光光了.\n你获得了${addcoin}金币!`
      }
    }
    else if(usernow)
    {
      return '贪心的人是不会有好运的...'
    }

    return '数据查询失败'
  });
  
}
