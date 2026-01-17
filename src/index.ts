import { Context, Schema,h } from 'koishi'
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
export const inject = ['database']
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
    await session.send(`俄罗斯轮盘帮助：\n开启游戏：装弹 ?[子弹数](默认3,最多6) ?[金额](默认200金币,最多${config.maxGold}) ?[at](指定决斗对象，为空则所有群友都可接受决斗)\示例：装弹 1 10\n接受对决：接受对决/拒绝决斗\n开始对决：开枪 ?[子弹数](默认1)（轮流开枪，根据子弹数量连开N枪械，分钟未开枪另一方可使用‘结算’命令结束对决并胜利）\n结算：结算（当某一方1分钟未开枪，可使用该命令强行结束对决并胜利）\n我的战绩：我的战绩\n排行榜：金币排行/胜场排行/败场排行/欧洲人排行/慈善家排行\n轮盘签到：每天可调用一次（最少获得1金币，最多获得${config.daylygold}金币）\n【注：同一时间群内只能有一场对决,发送命令各参数之间需要添加空格】`);
    return null;
  });
  ctx.command("russian.dayly","每日签到").alias('轮盘签到').action(async ({session})=>
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
      nfire=3;
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
      if(userat==`${session.platform}:${session.userId}`)
      {
        return 'baka！你要枪毙自己吗笨蛋~';
      }
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
  ctx.command('russian.duel.accept','接受对决').alias('接受对决').action(async({session})=>
  {
    let groupDuel=await getDuel(`${session.platform}:${session.channelId}`,ctx);
    if(groupDuel.status==3)
    {
      if(`${session.platform}:${session.userId}`==groupDuel.user1)
      {
        return 'baka！你要枪毙自己吗笨蛋~';
      }
      let user11=await getuser(`${session.platform}:${session.userId}`,`${session.platform}:${session.channelId}`,ctx);
      if(user11.gold<groupDuel.gold)
      {
        return `${h('at',{id:session.userId})} 你没有足够的钱支撑起这场挑战`;
      }
      groupDuel.timestart=new Date();
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
        groupDuel.timestart=new Date();
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
        groupDuel.timestart=new Date();
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
  ctx.command('russian.duel.finish','超时检测并结束对决').alias('结算').action(async ({session}) =>
  {
    let groupDuel=await getDuel(`${session.platform}:${session.channelId}`, ctx);
    if(groupDuel.status!=1)
    {
      return '目前没有进行中的对决，速速装弹!';
    }
    if(groupDuel.user1!=`${session.platform}:${session.userId}`&&groupDuel.user2!=`${session.platform}:${session.userId}`)
    {
      return '吃瓜群众不要捣乱';
    }
    let now=new Date();
    let user1=await getuser(`${session.platform}:${parseIdFromString(groupDuel.user1)}`,`${session.platform}:${session.channelId}`,ctx),user2=await getuser(`${session.platform}:${parseIdFromString(groupDuel.user2)}`,`${session.platform}:${session.channelId}`,ctx);
    if(now.getTime()-groupDuel.timestart.getTime()<60000)
    {
      return `${h('at',{id:session.userId})} ${user1.name} 和 ${user2.name} 比赛并未超时，请继续比赛...`;
    }
    if(groupDuel.round==1)
    {
      groupDuel.status=0;
      ctx.database.upsert('russianDuel',[groupDuel]);
      let winuser=user2,loseuser=user1;
      winuser.gold=winuser.gold+(groupDuel.gold*2);
      winuser.winGold=groupDuel.gold+winuser.winGold;
      winuser.winRound++;
      loseuser.loseGold=groupDuel.gold+loseuser.loseGold;
      loseuser.loseRound++;
      await ctx.database.upsert('russiandata', [winuser, loseuser]);
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
      groupDuel.status=0;
      ctx.database.upsert('russianDuel',[groupDuel]);
      let winuser=user1,loseuser=user2;
      winuser.gold=winuser.gold+(groupDuel.gold*2);
      winuser.winGold=groupDuel.gold+winuser.winGold;
      winuser.winRound++;
      loseuser.loseGold=groupDuel.gold+loseuser.loseGold;
      loseuser.loseRound++;
      await ctx.database.upsert('russiandata', [winuser, loseuser]);
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
  });
  ctx.command('russian.duel.refuse','拒绝对决').alias('拒绝对决').action(async ({session}) =>
  {
    let groupDuel=await getDuel(`${session.platform}:${session.channelId}`, ctx);
    if(groupDuel.status!=2)
    {
      return null;
    }
    if(groupDuel.user2!=`${session.platform}:${session.userId}`)
    {
      return '这不是发给你的邀请!';
    }
    groupDuel.status=0;
    await ctx.database.upsert('russianDuel', [groupDuel]);
    return '此邀请已取消!';
  });
  ctx.command('russian.rank.gold','金币排行').alias('金币排行').alias('金币排行榜').action(async ({session}) =>
  {
    let users=await ctx.database.get('russiandata',{channel:`${session.platform}:${session.channelId}`});
    let tot=10;
    let output:string='';
    users.sort((a,b)=>a.gold>b.gold?-1:0);
    for(let i=0;i<(await users).length;i++)
    {
      if(users[i].name!='undefined'&&tot>=1)
      {
        tot--;
        output=output+`${users[i].name}：${users[i].gold}\n`;
      }
    }
    return `\t金币排行榜\n`+output;
  });
  ctx.command('russian.myScore','我的战绩').alias('我的战绩').action(async ({session}) =>
  {
    let usernow=await getuser(`${session.platform}:${session.userId}`,`${session.platform}:${session.channelId}`,ctx);
    usernow.name=session.username;
    await ctx.database.upsert('russiandata', [usernow]);
    return `${session.username} 的战绩：\n金币：${usernow.gold}\n赢得金币：${usernow.winGold}\n赢得场数：${usernow.winRound}\n输掉金币：${usernow.loseGold}\n输掉场数：${usernow.loseRound}`;
  });
  ctx.command('russian.rank.winGold','累计赢得金币排行榜').alias('欧洲人排行').alias('欧洲人排行榜').action(async ({session}) =>
  {
    let users=await ctx.database.get('russiandata',{channel:`${session.platform}:${session.channelId}`});
    let tot=10;
    let output:string='';
    users.sort((a,b)=>a.winGold>b.winGold?-1:0);
    for(let i=0;i<(await users).length;i++)
    {
      if(users[i].name!='undefined'&&tot>=1)
      {
        tot--;
        output=output+`${users[i].name}：${users[i].winGold}\n`;
      }
    }
    return `\t欧洲人排行榜\n`+output;
  });
  ctx.command('russian.rank.loseGold','累计输掉金币排行榜').alias('慈善家排行').alias('慈善家排行榜').action(async ({session}) =>
  {
    let users=await ctx.database.get('russiandata',{channel:`${session.platform}:${session.channelId}`});
    let tot=10;
    let output:string='';
    users.sort((a,b)=>a.loseGold>b.loseGold?-1:0);
    for(let i=0;i<(await users).length;i++)
    {
      if(users[i].name!='undefined'&&tot>=1)
      {
        tot--;
        output=output+`${users[i].name}：${users[i].loseGold}\n`;
      }
    }
    return `\t慈善家排行榜\n`+output;
  });
  ctx.command('russian.rank.winRound','累计获胜场数排行榜').alias('胜场排行').alias('胜场排行榜').action(async ({session}) =>
  {
    let users=await ctx.database.get('russiandata',{channel:`${session.platform}:${session.channelId}`});
    let tot=10;
    let output:string='';
    users.sort((a,b)=>a.winRound>b.winRound?-1:0);
    for(let i=0;i<(await users).length;i++)
    {
      if(users[i].name!='undefined'&&tot>=1)
      {
        tot--;
        output=output+`${users[i].name}：${users[i].winRound}\n`;
      }
    }
    return `\t胜场排行榜\n`+output;
  });
  ctx.command('russian.rank.loseRound','累计输掉场数排行榜').alias('败场排行').alias('败场排行榜').action(async ({session}) =>
  {
    let users=await ctx.database.get('russiandata',{channel:`${session.platform}:${session.channelId}`});
    let tot=10;
    let output:string='';
    users.sort((a,b)=>a.loseRound>b.loseRound?-1:0);
    for(let i=0;i<(await users).length;i++)
    {
      if(users[i].name!='undefined'&&tot>=1)
      {
        tot--;
        output=output+`${users[i].name}：${users[i].loseRound}\n`;
      }
    }
    return `\t败场排行榜\n`+output;
  });
}
