// handle all discord functions
const Eris = require("eris")
const Constants = Eris.Constants
const Collection = Eris.Collection
const {bot} = require('./bot')
const {config,log,debugLog,tidyNumber}=require('../utils')
//const {exif}=require('../exif')
//const {messageCommands}=require('./messageCommands')
const {componentCommands}=require('./componentCommands')
const {slashCommands}=require('./slashCommands')
var colors = require('colors')
const {auth}=require('./auth')
const {emojiCommands} = require("./emojiCommands")
const {status} = require('./status')
const {db,Image} = require("../db")
let inviteLink = ''

chat=async(channel,msg,file=null,retry=0)=>{
  debugLog('chatting to channel '+channel)
  if(msg!==null&&msg!==''){
    try{
      if(file){
        bot.createMessage(channel,msg,file)
          .then(async r=>{
            // cache image in proxy server
            let data = file.file
            if(file.length>0){data = file[0].file}
            Image.create({url:r.attachments[0]?.proxy_url,data})
              .then((ul)=>{debugLog('Image cached in db: '+r.attachments[0]?.proxy_url)})
              .catch((err)=>{debugLog('Unable to cache image in db:');debugLog(err)})
          })
          .catch(async e=>{await chatFail(e,channel,msg,file,retry)})
      }else{bot.createMessage(channel,msg).then().catch(e=>{chatFail(e,channel,msg,null,retry)})}
    }catch(err){
      debugLog('Error posting to discord')
      debugLog(err)
    }}
}

chatFail=async(error,channel,msg,file=null,retry=0)=>{
  debugLog('caught error posting to discord:'.bgRed.black)
  debugLog(error.message)
  if(error.message?.includes('Request timed out')&&retry<2){
    retry++
    debugLog('Retry send attempt '+retry)
    let resent = await chat(channel,msg,file,retry)
    debugLog(resent)
  } else if(error.message?.includes('message_reference: Unknown message')&&msg.messageReference){
    debugLog('The request message was deleted before we responded, removing reference and trying again')
    delete msg.messageReference
    delete msg.message_reference
    chat(channel,msg,file)
  }
}

chatWin=(response,channel,msg,file)=>{
  debugLog('msg sent to channel '+channel.name+' id '+channel.id)
}

chatDM=async(id,msg,channel)=>{
  // try to DM, fallback to channel
  d = await bot.getDMChannel(id).catch(() => {
    debugLog('failed to get dm channel, sending public message instead')
    if (channel&&channel.length>0){
      bot.createMessage(channel,msg)
        .then(()=>{
          debugLog('DM sent to '.dim+id)
        })
        .catch((err) => {
          log(err)
          log('failed to both dm a user or message in channel'.bgRed.white)
        })}
  })
  d.createMessage(msg).catch(() => {
    if (channel&&channel.length>0){
      bot.createMessage(channel,msg)
        .then(()=>{
          debugLog('DM sent to '.dim+id)})
        .catch((err) => {
          log(err)
          log('failed to both dm a user or message in channel'.bgRed.white)
        })
      }
  })
}

deleteMsg=async(channelid,messageids,reason=undefined)=>{
  log('Deleting message ids '+messageids.join(',')+' in channelid '+channelid)
  if(reason)log('Reason:'+reason)
  bot.deleteMessages(channelid,messageids,reason)
    .then(r=>{log(r)})
    .catch(e=>{log(e)})
}

let lastMsgChan=null

let logChat=async(msg)=>{ // irc-like view
  if(lastMsgChan!==msg.channel?.id&&msg.channel?.name&&msg.channel.guild){
    r='#'+msg.channel.name.bgBlue+'-'+msg.channel.id+'-'+msg.channel.guild.name
    log(r)
    lastMsgChan=msg.channel.id // Track last channel so messages can be grouped with channel headers
  }
  log(msg.author?.username.bgBlue+':'+msg.content)
  msg.attachments.map((u)=>{return u.proxy_url}).forEach((a)=>{log(a)})
  msg.embeds.map((e)=>{return e}).forEach((e)=>{log(e)})
  msg.components.map((c)=>{return c}).forEach((c)=>{log(c)})
}

async function botInit(){
  bot.connect()
  bot.on('error', async(err)=>{log('discord error:'.bgRed);log(err)})
  bot.on("disconnect", () => {log('disconnected'.bgRed)})
  bot.on("guildCreate", (guild) => {
    var m='joined new guild: '+guild.name
    log(m.bgRed)
    debugLog(guild)
    chatDM(config.adminID,m)
  })
  bot.on("guildDelete", (guild) => {var m='left guild: '+guild.id;log(m.bgRed);chatDM(config.adminID,m)})
  bot.on('ready', async () => {
    log('Connected to '.bgGreen.black+' discord'.bgGreen+' in '+bot.guilds.size+' guilds')
    const totalUsers = bot.guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
    log('Total user count across all guilds: ' + totalUsers)
    inviteLink = 'https://discord.com/oauth2/authorize?client_id='+bot.application.id+'&scope=bot&permissions=124992'
    log(('Invite bot to server: '+inviteLink).dim)
    slashCommands.init()

    //if (config.hivePaymentAddress.length>0){checkNewPayments()}
  })
  // Runs on all messages received
  bot.on('messageCreate',async(msg)=>{
    if(config.ignoreAllBots&&msg.author.bot) return // ignore all bot messages
    if(config.logging.chat)logChat(msg)
    parseMsg(msg,bot.application.id).then().catch(e=>{log('Error on discord/parseMsg');log(e)})
  })
  // Runs on all interactions
  bot.on("interactionCreate", async (interaction) => {
    if(interaction instanceof Eris.CommandInteraction){slashCommands.parseCommand(interaction)}
    if(interaction instanceof Eris.ComponentInteraction){componentCommands.parseCommand(interaction)}
    if(interaction instanceof Eris.ModalSubmitInteraction){componentCommands.parseCommand(interaction)}
  })
  // Runs each time an emoji is added to a message
  bot.on("messageReactionAdd", async (msg,emoji,reactor) => {
    emojiCommands.parse(msg,emoji,reactor)
  })
  // Update status message max every 15 seconds if changed
  status.init()
}

module.exports={
  discord:{
    botInit,
    chat,
    chatDM,
    Constants,
    inviteLink
  }
}
