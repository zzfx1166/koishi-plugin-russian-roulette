import { Context, Schema,h } from 'koishi'
import {setEngine} from "node:crypto";
declare module 'koishi' {
  interface Tables {
    russiandata:usergold
    russianDule:dule
  }
}
function parseIdFromString(input: string): string | null {
  const match = input.match(/^.*:([A-Za-z0-9]+)$/);
  return match ? match[1] : null;
}
export const name = 'russian-roulette'
export const inject = ['database','console']
export interface Config {
  daylygold:number
}
export interface usergold {
  id: string
  time: Date
  gold:number
  channel:string
}
export interface dule{
  id: string
  status:number
  gold:number
  user1:string
  user2:string
  diePlace:number
  nowPlace:number
  round:number
  timestart:Date
}

async function getDule(channelid:string,ctx:Context):Promise<dule>
{
  let dules=await ctx.database.get('russianDule',channelid);
  let dulenow:dule;
  if(dules.length==0)
  {
    dulenow={id:channelid,status:0}as dule;
  }
  else
  {
    dulenow=dules[0];
    if(dulenow.timestart&&(dulenow.status==2||dulenow.status==3))
    {
      let nowtime=new Date();
      if(nowtime.getTime()-dulenow.timestart.getTime()>180000)dulenow.status=0;
    }
  }
  return dulenow;
}
async function getuser(userid:string,channelid:string,ctx:Context):Promise<usergold>
{
  let unid=`${userid}:${channelid}`;
  let users=await ctx.database.get('russiandata',unid);
  let usernow:usergold;
  if(users.length==0)
  {
    usernow={id:unid,time:new Date(1949,10,1),gold:100,channel:channelid};
  }
  else
  {
    usernow=users[0];
  }
  return usernow;
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
    gold: 'unsigned',
    channel: 'string'
  });
  ctx.model.extend('russianDule',{
    id: 'string',
    status:'unsigned',
    gold:'unsigned',
    user1:'string',
    user2:'string',
    diePlace:'unsigned',
    nowPlace:'unsigned',
    round:'unsigned'
  });

  ctx.command("russian.help","俄罗斯轮盘帮助").alias('俄罗斯轮盘帮助').action(async({session})=>
  {
    await session.send("俄罗斯轮盘帮助：\n开启游戏：装弹 [子弹数] ?[金额](默认200金币) ?[at](指定决斗对象，为空则所有群友都可接受决斗)\示例：装弹 1 10\n接受对决：接受对决/拒绝决斗\n开始对决：开枪 ?[子弹数](默认1)（轮流开枪，根据子弹数量连开N枪械，分钟未开枪另一方可使用‘结算’命令结束对决并胜利）\n结算：结算（当某一方3分钟未开枪，可使用该命令强行结束对决并胜利）\n我的战绩：我的战绩\n排行榜：金币排行/胜场排行/败场排行/欧洲人排行/慈善家排行\n【注：同一时间群内只能有一场对决】");
    return null;
  });
  ctx.command("russian.dayly","每日签到").alias('轮盘签到').action(async ({session})=>  // 添加 async
  {
    let addcoin=getRandomInt(config.daylygold)+1;
    const userId = `${session.platform}:${session.userId}`
    const channelId = `${session.platform}:${session.channelId}`
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let usernow=await getuser(userId, channelId,ctx);
    if(usernow && (usernow.gold === -100 || !usernow.time || new Date(usernow.time).getTime() < today.getTime()))
    {
      if(usernow.gold === -100)
      {
        usernow.gold = 100;
      }
      usernow.time = today;
      usernow.gold += addcoin;
      let users=[usernow];
      await ctx.database.upsert('russiandata', users);
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
  ctx.command('russian.mycoin',"查询自己的金币").alias('我的金币').action(async({session})=>
  {
    console.log(`${session.platform}:${session.channelId}`);
    let usernow=await getuser(`${session.platform}:${session.userId}`,`${session.platform}:${session.channelId}`,ctx);
    if(usernow)
    {
      await ctx.database.upsert('russiandata', [usernow]);
      return `你现在有${usernow.gold}枚金币`;
    }
    else
    {
      return '数据库查询失败';
    }
  });
  ctx.command("russian.querycoin <userat:user>","查询别人金币数量").action(async({session},userat)=>
  {
    console.log(parseIdFromString(userat));
    let usernow=await getuser(userat,`${session.platform}:${session.channelId}`,ctx);
    if(usernow)
    {
      await ctx.database.upsert('russiandata', [usernow]);
      return `${h('at',{id:parseIdFromString(userat)})}的金币数量是${usernow.gold}`;
    }
    else
    {
      return '数据库查询失败或用户不存在';
    }
  });
  ctx.command("russian.duel [fire:number] [inputCoin:number] [userat:user]","发起轮盘对决").alias('装弹').action(async({session},fire,inputCoin,userat)=>
  {
    let groupDule=await getDule(`${session.platform}:${session.channelId}`,ctx);
    if(groupDule.status!=0)
    {
      return '当前有对决进行中!';
    }
    let coin:number,nfire:number;
    if(!inputCoin)
    {
      coin = 200;
    }
    else
    {
      coin=inputCoin;
    }
    if(!fire)
    {
      nfire=1;
    }
    else
    {
      nfire=fire;
    }
    groupDule.user1=`${session.platform}:${session.userId}`;
    groupDule.diePlace=getRandomInt(7-nfire)+1;
    groupDule.nowPlace=1;
    groupDule.round=1;
    groupDule.timestart=new Date();
    if(userat)
    {
      groupDule.user2=userat;
      groupDule.status=2;
      await session.send(`${h('at',{id:session.userId})}向${h('at',{id:parseIdFromString(userat)})}发起了决斗!\n请${h('at',{id:parseIdFromString(userat)})}在三分钟内回复‘接受对决’ or ‘拒绝对决’，超时此次决斗作废！`);
    }
    else
    {
      groupDule.status=3;
      await session.send(`若3分钟内无人接受挑战则此次对决作废【首次游玩请发送 ’俄罗斯轮盘帮助‘ 来查看命令】`);
    }
    await ctx.database.upsert('russianDule', [groupDule]);
    return null;
  });
  ctx.command('russian.duelcancel','强制取消对决').action(async({session})=>{
    let groupdule=await getDule(`${session.platform}:${session.channelId}`,ctx);
    groupdule.status=0;
    ctx.database.upsert('russianDule',[groupdule]);
    return '已取消';
  });
}
