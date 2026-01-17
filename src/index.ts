import { Context, Schema,h } from 'koishi'
import {setEngine} from "node:crypto";
declare module 'koishi' {
  interface Tables {
    russiandata:usergold
    russianDuel:duel
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
  maxGold:number
}
export interface usergold {
  id: string
  time: Date
  gold:number
  channel:string
  name:string
  winRound:number
  loseRound:number
  winGold:number
  loseGold:number
}
export interface duel{
  id: string
  status:number
  gold:number
  user1:string
  user2:string
  diePlace:number
  nowPlace:number
  round:number
  timestart:Date
  shot:number
}
function roundToDecimal(num: number, decimalPlaces: number): number
{
  return Number(num.toFixed(decimalPlaces));
}
async function getDuel(channelid:string,ctx:Context):Promise<duel>
{
  let duels=await ctx.database.get('russianDuel',channelid);
  let duelnow:duel;
  if(duels.length==0)
  {
    duelnow={id:channelid,status:0}as duel;
  }
  else
  {
    duelnow=duels[0];
    if(duelnow.timestart&&(duelnow.status==2||duelnow.status==3))
    {
      let nowtime=new Date();
      if(nowtime.getTime()-duelnow.timestart.getTime()>=30000)duelnow.status=0;
    }
  }
  return duelnow;
}
async function getuser(userid:string,channelid:string,ctx:Context):Promise<usergold>
{
  let unid=`${userid}:${channelid}`;
  let users=await ctx.database.get('russiandata',unid);
  let usernow:usergold;
  if(users.length==0)
  {
    usernow={id:unid,time:new Date(1900,0,1),gold:0,channel:channelid,name:'undefind',winGold:0,loseGold:0,winRound:0,loseRound:0};
  }
  else
  {
    usernow=users[0];
  }
  return usernow;
}
export const Config: Schema<Config> = Schema.object({
  daylygold: Schema.number().default(100).description('每日获得最多金币量'),
  maxGold:Schema.number().default(1000).description('对决最大金币量')
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
    channel: 'string',
    name:'string',
    winGold:'unsigned',
    loseGold:'unsigned',
    winRound:'unsigned',
    loseRound:'unsigned'
  });
  ctx.model.extend('russianDuel',{
    id: 'string',
    status:'unsigned',
    gold:'unsigned',
    user1:'string',
    user2:'string',
    diePlace:'unsigned',
    nowPlace:'unsigned',
    round:'unsigned',
    timestart:'timestamp',
    shot:'unsigned'
  });

  ctx.command("russian.help","俄罗斯轮盘帮助").alias('俄罗斯轮盘帮助').action(async({session})=>
  {
    await session.send("俄罗斯轮盘帮助：\n开启游戏：装弹 [子弹数] ?[金额](默认200金币) ?[at](指定决斗对象，为空则所有群友都可接受决斗)\示例：装弹 1 10\n接受对决：接受对决/拒绝决斗\n开始对决：开枪 ?[子弹数](默认1)（轮流开枪，根据子弹数量连开N枪械，分钟未开枪另一方可使用‘结算’命令结束对决并胜利）\n结算：结算（当某一方1分钟未开枪，可使用该命令强行结束对决并胜利）\n我的战绩：我的战绩\n排行榜：金币排行/胜场排行/败场排行/欧洲人排行/慈善家排行\n【注：同一时间群内只能有一场对决】");
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
      usernow.name=session.username;
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
      usernow.name=session.username;
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
    let groupDuel=await getDuel(`${session.platform}:${session.channelId}`,ctx);
    if(groupDuel.status!=0)
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
    if(nfire<1||nfire>6)
    {
      return '子弹不合法';
    }
    if(coin<1||coin>config.maxGold)
    {
      return '金币不合法';
    }
    let user1=await getuser(`${session.platform}:${session.userId}`,`${session.platform}:${session.channelId}`,ctx);
    if(user1.gold<coin)
    {
      return `${h('at',{id:session.userId})} 你没有足够的钱支撑起这场挑战`;
    }
    groupDuel.user1=`${session.platform}:${session.userId}`;
    groupDuel.diePlace=getRandomInt(7-nfire)+1;
    groupDuel.nowPlace=1;
    groupDuel.round=1;
    groupDuel.gold=coin;
    groupDuel.shot=nfire;
    groupDuel.timestart=new Date();
    let fires:string='';
    for(let i=1;i<=nfire;i++)
    {
      fires=fires+'咔，';
    }
    fires=fires+`装填完毕\n挑战金额：${groupDuel.gold}\n第一枪的概率为${roundToDecimal(groupDuel.shot/(7-groupDuel.nowPlace)*100,2)}%`;
    if(userat)
    {
      let usernow=await getuser(userat,`${session.platform}:${session.channelId}`,ctx);
      if(usernow.gold<coin)
      {
        return '你邀请的人金币不足!';
      }
      groupDuel.user2=userat;
      groupDuel.status=2;
      await session.send(fires+`\n${h('at',{id:session.userId})}向${h('at',{id:parseIdFromString(userat)})}发起了决斗!\n请${h('at',{id:parseIdFromString(userat)})}在30秒内回复‘接受对决’ or ‘拒绝对决’，超时此次决斗作废！`);
    }
    else
    {
      groupDuel.status=3;
      await session.send(fires+`\n若30秒内无人接受挑战则此次对决作废【首次游玩请发送 ’俄罗斯轮盘帮助‘ 来查看命令】`);
    }
    await ctx.database.upsert('russianDuel', [groupDuel]);
    return null;
  });
  ctx.command('russian.duel.cancel','强制取消对决').action(async({session})=>{
    let groupduel=await getDuel(`${session.platform}:${session.channelId}`,ctx);
    groupduel.status=0;
    await ctx.database.upsert('russianDuel', [groupduel]);
    return '已取消';
  });
  ctx.command('russian.duel.accept','接受对决').alias('接受对决').action(async({session})=>
  {
    let groupDuel=await getDuel(`${session.platform}:${session.channelId}`,ctx);
    if(groupDuel.status==3)
    {
      let user11=await getuser(`${session.platform}:${session.userId}`,`${session.platform}:${session.channelId}`,ctx);
      if(user11.gold<groupDuel.gold)
      {
        return `${h('at',{id:session.userId})} 你没有足够的钱支撑起这场挑战`;
      }
      groupDuel.status=1;
      groupDuel.user2=`${session.platform}:${session.userId}`;
      let user1=await getuser(`${session.platform}:${parseIdFromString(groupDuel.user1)}`,`${session.platform}:${session.channelId}`,ctx),user2=await getuser(`${session.platform}:${parseIdFromString(groupDuel.user2)}`,`${session.platform}:${session.channelId}`,ctx);
      user1.gold-=groupDuel.gold;
      user2.gold-=groupDuel.gold;
      await ctx.database.upsert('russiandata', [user1,user2]);
      await ctx.database.upsert('russianDuel', [groupDuel]);
      return `${h('at',{id:session.userId})}接受了对决!\n请${h('at',{id:parseIdFromString(groupDuel.user1)})}先开枪!`;
    }
    else if(groupDuel.status==2)
    {
      if(groupDuel.user2==`${session.platform}:${session.userId}`)
      {
        groupDuel.status=1;
        let user1=await getuser(`${session.platform}:${parseIdFromString(groupDuel.user1)}`,`${session.platform}:${session.channelId}`,ctx),user2=await getuser(`${session.platform}:${parseIdFromString(groupDuel.user2)}`,`${session.platform}:${session.channelId}`,ctx);
        user1.gold-=groupDuel.gold;
        user2.gold-=groupDuel.gold;
        await ctx.database.upsert('russiandata', [user1,user2]);
        await ctx.database.upsert('russianDuel', [groupDuel]);
        return `${h('at',{id:session.userId})}接受了对决!\n请${h('at',{id:parseIdFromString(groupDuel.user1)})}先开枪!`;
      }
      else
      {
        return '这场对决邀请的对手不是你!';
      }
    }
    else
    {
      return '当前没有处于邀请状态的对决!';
    }
  });
  ctx.command('russian.duel.shot [shots:number]','开枪').alias('开枪').action(async({session},shots)=>
  {
    let shot:number;
    if(!shots)
    {
      shot=1;
    }
    else
    {
      shot=shots;
    }
    if(shots<1)
    {
      return '子弹不合法';
    }
    let groupDuel=await getDuel(`${session.platform}:${session.channelId}`,ctx);
    if(groupDuel.status!=1)
    {
      return '不存在正在进行的对决!';
    }
    let user=`${session.platform}:${session.userId}`;
    if(((groupDuel.round==1&&groupDuel.user1==user)||(groupDuel.round==2&&groupDuel.user2==user)))
    {
      groupDuel.nowPlace+=shot;
      if(groupDuel.nowPlace>groupDuel.diePlace)
      {
        if(groupDuel.round==2)
        {
          groupDuel.user2=groupDuel.user1;
        }
        groupDuel.status=0;
        // let user2=await getuser(session.platform,session.userId,ctx),user1=await getuser(session.platform,parseIdFromString(groupDuel.user2),ctx);
        await ctx.database.upsert('russianDuel', [groupDuel]);
        let winuser=await getuser(`${session.platform}:${parseIdFromString(groupDuel.user2)}`,`${session.platform}:${session.channelId}`,ctx),loseuser=await getuser(`${session.platform}:${session.userId}`,`${session.platform}:${session.channelId}`,ctx);
        winuser.gold=winuser.gold+(groupDuel.gold*2);
        winuser.winGold=groupDuel.gold+winuser.winGold;
        winuser.winRound++;
        loseuser.loseGold=groupDuel.gold+loseuser.loseGold;
        loseuser.loseRound++;
        await ctx.database.upsert('russiandata', [winuser, loseuser]);
        let dieWord:string,rnd=getRandomInt(3);
        if(rnd==0)
        {
          dieWord='终究还是你先走一步...';
        }
        else if(rnd==1)
        {
          dieWord='眼前一黑，你直接穿越到了异世界...(死亡)';
        }
        else
        {
          dieWord='"嘭！"，你直接去世了';
        }
        await session.send(`${h('at',{id:session.userId})} ${dieWord}\n第${groupDuel.diePlace}发子弹送走了你`);
        await session.send(`这场对决是 ${winuser.name} 获胜了`);
        return `结算：\n`+
          `\t胜者：${winuser.name}\n`+
          `\t赢取金币：${groupDuel.gold}\n`+
          `\t累计胜场：${winuser.winRound}\n`+
          `\t累计赚取金币：${winuser.winGold}\n`+
          `-------------------\n`+
          `\t败者：${loseuser.name}\n`+
          `\t输掉金币：${groupDuel.gold}\n`+
          `\t累计败场：${loseuser.loseRound}\n`+
          `\t累计输掉金币：${loseuser.loseGold}\n`;
      }
      else
      {
        if(groupDuel.round==1)
        {
          groupDuel.round=2;
        }
        else
        {
          groupDuel.round=1;
        }
        await ctx.database.upsert('russianDuel', [groupDuel]);
        if(groupDuel.round==1)
        return `咔 ，你没死，看来运气不错\n下一枪中弹的概率：${roundToDecimal(groupDuel.shot/(7-groupDuel.nowPlace)*100,2)}%\n轮到${h('at',{id:parseIdFromString(groupDuel.user1)})}了`;
        else
        return `咔 ，你没死，看来运气不错\n下一枪中弹的概率：${roundToDecimal(groupDuel.shot/(7-groupDuel.nowPlace)*100,2)}%\n轮到${h('at',{id:parseIdFromString(groupDuel.user2)})}了`;
      }
    }
  });
}
