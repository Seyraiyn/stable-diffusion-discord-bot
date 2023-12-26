const {config,log,debugLog,getRandomColorDec,shuffle,urlToBuffer,getUUID,extractFilenameFromUrl,isURL}=require('../utils')
const {exif}=require('../exif')
const {invoke}=require('../invoke')
const {bot}=require('./bot')
const {auth}=require('./auth')
const {imageEdit}=require('../imageEdit')
const parseArgs = require('minimist')
const {fonturls} = require('../fonturls')
// Process discord text message commands
let commands = [
    {
        name: 'dream',
        description: 'Text to image',
        permissionLevel: 'all',
        aliases: ['dream','drm','imagine','magin','drm3'],
        prefix:'!',
        command: async (args,msg)=>{
            msg.addReaction('🫡') // salute emoji
            /* todo update to accept multiple init images
                let images = await extractImagesAndUrlsFromMessageOrReply(msg)
                images will be an array in format [{url:'url here','img:'buffer here'}]
                pass them through in place of img object and we deal with it elsewhere
                do not save inputImageUrl meta tag here anymore
                result = await invoke.jobFromDream(args,images,{type:'discord',msg:trackingmsg})
            */
            let img,imgurl
            let imgres = await extractImageAndUrlFromMessageOrReply(msg)
            if(imgres&&imgres?.img&&imgres?.url){img=imgres.img;imgurl=imgres.url}
            let trackingmsg = await bot.createMessage(msg.channel.id,{content:':saluting_face: dreaming'})
            result = await invoke.jobFromDream(args,img,{type:'discord',msg:trackingmsg})
            // inject the original template image url
            if(imgurl && !result.error && result.images?.length > 0){
                debugLog('Attaching input image url to png metadata: '+imgurl)
                result.images[0].buffer = await exif.modify(result.images[0].buffer,'arty','inputImageUrl',imgurl)
            }
            return returnMessageResult(msg,result)
        }
    },
    {
        name: 'depth',
        description: 'Return a depth map of an input image',
        permissionLevel: 'all',
        aliases: ['depth'],
        prefix:'!',
        command: async(args,msg)=>{
            debugLog('depth map creation triggered: '+args.join(' '))
            let img,imgurl
            let imgres = await extractImageAndUrlFromMessageOrReply(msg)
            if(imgres&&imgres?.img&&imgres?.url){img=imgres.img;imgurl=imgres.url}
            if(img){
                msg.addReaction('🫡') // salute emoji
                let result = await invoke.processImage(img,null,'depthmap',{a_mult:2,bg_th:0.1})
                if (result?.images?.length>0){
                    let buf = result.images[0]?.buffer
                    buf = await exif.modify(buf,'arty','imageType','depth')
                    return {messages:[{embeds:[{description:'Converted image to depth map',color:getRandomColorDec()}]}],files:[{file:buf,name:result.images[0].name}]}
                } else {
                    return {error:'Failed depth map creation'}
                }
            } else {
                return { error:'No image attached to create depthmap'}
            }
        }
    },
    {
        name: 'edges',
        description: 'Return a canny edge detection of an input image',
        permissionLevel: 'all',
        aliases: ['edge','edges','canny'],
        prefix:'!',
        command: async(args,msg)=>{
            debugLog('canny edge detection creation triggered: '+args.join(' '))
            let img,imgurl
            let imgres = await extractImageAndUrlFromMessageOrReply(msg)
            if(imgres&&imgres?.img&&imgres?.url){img=imgres.img;imgurl=imgres.url}
            if(img){
                let result = await invoke.processImage(img,null,'canny',{low_threshold:100,high_threshold:200})
                if(result?.images?.length>0){
                    let buf = result.images[0]?.buffer
                    buf = await exif.modify(buf,'arty','imageType','canny')
                    return {messages:[{embeds:[{description:'Converted to canny edge detection',color:getRandomColorDec()}]}],files:[{file:buf,name:result.images[0].name}]}
                } else {
                    return {error:'Failed canny edge detection'}
                }
            } else {
                return { error:'No image attached to create canny edge detection'}
            }
        }
    },
    {
        name: 'lineart',
        description: 'Return a lineart version of an input image',
        permissionLevel: 'all',
        aliases: ['lineart'],
        prefix:'!',
        command: async(args,msg)=>{
            debugLog('lineart creation triggered: '+args.join(' '))
            let img,imgurl
            let imgres = await extractImageAndUrlFromMessageOrReply(msg)
            if(imgres&&imgres?.img&&imgres?.url){img=imgres.img;imgurl=imgres.url}
            if(img){
                let result = await invoke.processImage(img,null,'lineart',{detect_resolution:512,image_resolution:512,coarse:false})
                if(result?.images?.length>0){
                    let buf = result.images[0]?.buffer
                    buf = await exif.modify(buf,'arty','imageType','lineart')
                    return {messages:[{embeds:[{description:'Converted to lineart',color:getRandomColorDec()}]}],files:[{file:buf,name:result.images[0].name}]}
                } else {
                    return {error:'Failed lineart'}
                }
            } else {
                return { error:'No image attached to create lineart'}
            }
        }
    },
    {
        name: 'lineartanime',
        description: 'Return a lineart anime version of an input image',
        permissionLevel: 'all',
        aliases: ['lineartanime'],
        prefix:'!',
        command: async(args,msg)=>{
            debugLog('lineart anime creation triggered: '+args.join(' '))
            let img,imgurl
            let imgres = await extractImageAndUrlFromMessageOrReply(msg)
            if(imgres&&imgres?.img&&imgres?.url){img=imgres.img;imgurl=imgres.url}
            if(img){
                let result = await invoke.processImage(img,null,'lineartanime',{detect_resolution:512,image_resolution:512})
                if(result?.images?.length>0){
                    let buf = result.images[0]?.buffer
                    buf = await exif.modify(buf,'arty','imageType','lineartanime')
                    return {messages:[{embeds:[{description:'Converted to lineart anime',color:getRandomColorDec()}]}],files:[{file:buf,name:result.images[0].name}]}
                } else {
                    return {error:'Failed lineart anime'}
                }
            } else {
                return { error:'No image attached to create lineart anime'}
            }
        }
    },
    {
        name: 'colormap',
        description: 'Return a pixelated color map version of an input image',
        permissionLevel: 'all',
        aliases: ['colormap','colourmap'],
        prefix:'!',
        command: async(args,msg)=>{
            debugLog('color map creation triggered: '+args.join(' '))
            let img,imgurl
            let imgres = await extractImageAndUrlFromMessageOrReply(msg)
            if(imgres&&imgres?.img&&imgres?.url){img=imgres.img;imgurl=imgres.url}
            if(img){
                debugLog(args)
                let tile_size = args.length>0 ? parseInt(args[0]) : 64
                let result = await invoke.processImage(img,null,'colormap',{tile_size:tile_size})
                if(result?.images?.length>0){
                    let buf = result.images[0]?.buffer
                    buf = await exif.modify(buf,'arty','imageType','colormap')
                    return {messages:[{embeds:[{description:'Converted to colormap with tile size '+tile_size,color:getRandomColorDec()}]}],files:[{file:buf,name:result.images[0].name}]}
                } else {
                    return {error:'Failed color map'}
                }
            } else {
                return { error:'No image attached to create color map'}
            }
        }
    },
    {
        name: 'pose',
        description: 'Return a openpose pose detection of an input image',
        permissionLevel: 'all',
        aliases: ['pose','openpose'],
        prefix:'!',
        command: async(args,msg)=>{
            debugLog('pose detection creation triggered: '+args.join(' '))
            let img,imgurl
            let imgres = await extractImageAndUrlFromMessageOrReply(msg)
            if(imgres&&imgres?.img&&imgres?.url){img=imgres.img;imgurl=imgres.url}
            if(img){
                let result = await invoke.processImage(img,null,'openpose',{detect_resolution:512,hand_and_face:true,image_resolution:512})
                if(result?.images?.length>0){
                    let buf = result.images[0]?.buffer
                    buf = await exif.modify(buf,'arty','imageType','openpose')
                    let components = [{type:1,components:[{type: 2, style: 1, label: 'Use this pose', custom_id: 'usepose', emoji: { name: '🤸', id: null}, disabled: true }]}]
                    return {messages:[{embeds:[{description:'Converted to openpose detection',color:getRandomColorDec()}],components:components}],files:[{file:buf,name:result.images[0].name}]}
                }else{
                    return {error:'Failed at openpose detection'}
                }
            } else {
                return { error:'No image attached to create pose detection'}
            }
        }
    },
    {
        name: 'esrgan',
        description: 'Return a 2x upscaled version of an input image',
        permissionLevel: 'all',
        aliases: ['esrgan','upscale'],
        prefix:'!',
        command: async(args,msg)=>{
            debugLog('esrgan triggered: '+args.join(' '))
            // debugLog(host.config?.upscaling_methods?.upscaling_models)
            // RealESRGAN_x2plus.pth
            // RealESRGAN_x4plus.pth
            // RealESRGAN_x4plus_anime_6B
            // ESRGAN_SRx4_DF2KOST_official-ff704c30.pth
            let modelname='RealESRGAN_x2plus.pth'
            let img,imgurl
            let imgres = await extractImageAndUrlFromMessageOrReply(msg)
            if(imgres&&imgres?.img&&imgres?.url){img=imgres.img;imgurl=imgres.url}
            if(img){
                msg.addReaction('🫡') // salute emoji
                //let result = await invoke.esrgan(img,null,modelname)
                let result = await invoke.processImage(img,null,'esrgan',{model_name:modelname})
                if(result.error){return {error:result.error}}
                let buf = result.images[0]?.buffer
                let resolution = await imageEdit.getResolution(buf)
                let newWidth = resolution?.width
                let newHeight = resolution?.height
                return {messages:[{embeds:[{description:'Upscaled 2x with '+modelname+' to '+newWidth+' x '+newHeight,color:getRandomColorDec()}],components:[]}],files:[{file:buf,name:result.images[0].name}]}
            } else {
                return { error:'No image attached to upscale'}
            }
        }
    },
    {
        name: 'metadata',
        description: 'Extract metadata from images',
        permissionLevel: 'all',
        aliases: ['metadata'],
        prefix:'!',
        command: async (args,msg)=>{
            log('new metadata request')
            if(msg.messageReference?.messageID){
                sourcemsg = await bot.getMessage(msg.channel.id,msg.messageReference.messageID)
                let meta = await extractMetadataFromMessage(sourcemsg)
                log('Got meta from sourcemsg')
                log(meta)
            } else {
                let meta = await extractMetadataFromMessage(msg)
                log('Got meta from image')
                log(meta)
            }
            if(meta){
                return {message:[{content:meta}]}
            } else {
                return {error:'Unable to find metadata'}
            }
        }
    },
    {
        name: 'help',
        description: 'Show help dialog, about this bot',
        permissionLevel: 'all',
        aliases: ['help'],
        prefix:'!',
        command: async(args,msg)=>{
            let response = await help()
            return {messages:[response]}
        }
    },
    {
        name: 'text',
        description: 'Create an image containing text for use as an controlnet input image, overlay if an image is supplied',
        permissionLevel: 'all',
        aliases: ['text'],
        prefix:'!',
        command: async (args,msg)=>{
            let text = args.join(' ')
            let img,imgurl
            let imgres = await extractImageAndUrlFromMessageOrReply(msg)
            if(imgres&&imgres?.img&&imgres?.url){img=imgres.img;imgurl=imgres.url}
            if(messageHasImageAttachments(msg)){ img = await extractImageBufferFromMessage(msg)}
            result = await imageEdit.textOverlay(text,img)
            return result
        }
    },
    {
        name: 'textfontimage',
        description: 'Create an image containing text for use as an controlnet input image, using invokes "textfontimage" community node from mickr777',
        permissionLevel: 'all',
        aliases: ['textfontimage'],
        prefix:'!',
        command: async (args,msg)=>{
            // todo import and use parseArgs to parse settings
            let userId=msg.user?.id||msg.member?.id||msg.author?.id
            let options = parseArgs(args,{string:['row2']})
            //let row2 = options['--'].join(' ')
            //let fonts = fonturls.list()
            let fonturl = null
            if(options.font){
                // convert font name to font url
                fonturl=fonturls.get(options.font)
                //debugLog(fonturl)
                if(!fonturl){return {error:'Unable to find font name `'+options.font+'`'}}
            } else {
                let f = fonturls.random()
                options.font = f.name
                fonturl = f.url
            }
            let parsedOptions = {
                text_input: options._.join(' '),
                text_input_second_row: options.row2??'',
                second_row_font_size:options.row2size??'',
                font_url:fonturl,
                local_font_path:'',
                local_font:'',
                image_width:options.width??1024,
                image_height:options.height??1024,
                padding:options.padding??100,
                row_gap:options.gap??50
            }
            //log(parsedOptions)
            result = await invoke.textFontImage(parsedOptions)
            if(result.error||result.images.length==0){return {error:'Error in textfontimage'}}
            let response = {
                embeds:[
                    {description:':tada: textfontimage result for <@'+userId+'>\nText: `'+parsedOptions.text_input+'`, Width:`'+result.images[0].width+'` , Height: `'+result.images[0].height+'`, Font: `'+options.font+'`, Padding: `'+parsedOptions.padding+'`, Gap: `'+parsedOptions.row_gap+'`',color:getRandomColorDec()}
                ]/*,
                components:[{type:1,components:[
                    {type: 2, style: 1, label: 'depth controlnet (clear)', custom_id: 'depthcontrol', emoji: { name: '🪄', id: null}, disabled: true },
                    {type: 2, style: 1, label: 'qrcode controlnet (subtle)', custom_id: 'qrcontrol', emoji: { name: '🪄', id: null}, disabled: true }
                ]}]*/
            }
            return {
                messages:[response],
                files:[{file:result.images[0].buffer,name:result.images[0].name}]
            }
            //return result
        }
    },
    //https://github.com/mickr777/textfontimage
    {
        name: 'append',
        description: 'Append to a renders prompt and arguments',
        permissionLevel: 'all',
        aliases: ['..'],
        prefix:'',
        command: async(args,msg)=>{
            let replymsg,meta,img
            let parsedCmd = parseArgs(args,{boolean:['facemask','invert','hrf']})
            if(msg.messageReference?.messageID){
                replymsg = await bot.getMessage(msg.channel.id, msg.messageReference.messageID)
                if(replymsg.member.id===bot.application.id&&messageHasImageAttachments(replymsg)){
                    //msg.addReaction('🫡') // salute emoji
                    meta = await extractMetadataFromMessage(replymsg)
                    meta.invoke.prompt = meta.invoke?.prompt+' '+parsedCmd._.join(' ')
                } else {
                    return
                }
            } else {
                return
            }
            let trackingmsg = await bot.createMessage(msg.channel.id,{content:':saluting_face: dreaming'})
            Object.keys(parsedCmd).forEach(k=>{
                debugLog('Appending '+meta.invoke[k]+' : '+parsedCmd[k])
                if(k!=='_'){meta.invoke[k] = parsedCmd[k]}
            })
            if(meta.invoke?.inputImageUrl){img=urlToBuffer(meta.invoke.inputImageUrl)}
            result = await invoke.jobFromMeta(meta,img,{type:'discord',msg:trackingmsg})
            if(meta.invoke?.inputImageUrl && !result.error && result.images?.length > 0){
                debugLog('Attaching input image url to png metadata: '+meta.invoke?.inputImageUrl)
                result.images[0].buffer = await exif.modify(result.images[0].buffer,'arty','inputImageUrl',meta.invoke?.inputImageUrl)
            }
            return returnMessageResult(msg,result)
        }
    },
    {
        name: 'unregisterSlashCommands',
        description: 'forcibly remove all registered slash commands from the server',
        permissionLevel: 'admin',
        aliases: ['unregisterslashcommands'],
        prefix:'!!!',
        command: async(args,msg)=>{
            await bot.bulkEditCommands([])
            let response = {content:':information_source: Unregistered Slash Commands'}
            return {messages:[response]}
        }
    },
    {
        name: 'restart',
        description: 'forcibly restart the bot process',
        permissionLevel: 'admin',
        aliases: ['restart','rstrt'],
        prefix:'!!!',
        command: async(args,msg)=>{
            process.exit(0)
        }
    },
    {
        name: 'avatar',
        description: 'Replies with the large version of any mentioned users avatar, or their own if nobody is mentioned',
        permissionLevel: 'all',
        aliases: ['avatar','avtr'],
        prefix:'!',
        command: async(args,msg)=>{
            let avatars=[]
            let messages=[]
            let userId=msg.user?.id||msg.member?.id||msg.author?.id
            log(userId)
            let components = [{type:1,components:[{type: 2, style: 1, label: 'Pimp', custom_id: 'pimp', emoji: { name: '🪄', id: null}, disabled: true }]}]
            if(msg.mentions?.length>0){
                for (const m in msg.mentions){
                    let uid=msg.mentions[m].id
                    let url=await getAvatarUrl(uid)
                    let buf = await urlToBuffer(url)
                    avatars.push({file:buf,name:getUUID()+'.png'})
                    messages.push({embeds:[{description:'Here is <@'+uid+'>\'s full size avatar:',color:getRandomColorDec()}],components:components})
                }
            } else {
                let url=await getAvatarUrl(userId)
                let buf = await urlToBuffer(url)
                avatars.push({file:buf,name:getUUID()+'.png'})
                messages.push({embeds:[{description:'Here is <@'+userId+'>\'s full size avatar:',color:getRandomColorDec()}],components:components})
            }
            if(avatars.length>0){return {messages:messages,files:avatars}}
        }
    },
    {
        name: 'models',
        description: 'List currently available models',
        permissionLevel: 'all',
        aliases:['models','mdl'],
        prefix:'!',
        command: async(args,msg)=>{
            let models = await invoke.allUniqueModelsAvailable()
            let sd1 = models.filter(obj => obj.base_model === 'sd-1')
            let sd2 = models.filter(obj => obj.base_model === 'sd-2')
            let sdxl = models.filter(obj => obj.base_model === 'sdxl')
            let dialog = {
                content:'',
                flags:64,
                embeds:[
                    {description:'Models currently available\n**sd-1**: '+sd1.length+' , **sd-2**: '+sd2.length+' **sdxl**: '+sdxl.length,color:getRandomColorDec()}
                ],
                components:[]
            }
            let basemodels = ['sd-1','sd-2','sdxl']
            for (const modeltype in basemodels){
                let filteredModels = models.filter(obj=>obj.base_model===basemodels[modeltype])
                let marr=[]
                for (const m in filteredModels){
                    let model = filteredModels[m]
                    marr.push(model.model_name)
                }
                if(marr.length>0){
                    let newdlg = {color:getRandomColorDec(),description:'**'+basemodels[modeltype]+' models**:\n'+marr.join('\n')}
                    dialog.embeds.push(newdlg)
                }
            }
            return {messages:[dialog],files:[]}
        }
    },
    {
        name: 'loras',
        description: 'List currently available loras',
        permissionLevel: 'all',
        aliases:['lora','loras'],
        prefix:'!',
        command: async(args,msg)=>{
            let models = await invoke.allUniqueLorasAvailable()
            let sd1 = models.filter(obj => obj.base_model === 'sd-1')
            let sd2 = models.filter(obj => obj.base_model === 'sd-2')
            let sdxl = models.filter(obj => obj.base_model === 'sdxl')
            let dialog = {
                content:'',
                flags:64,
                embeds:[
                    {description:'Loras currently available\n**sd-1**: '+sd1.length+' , **sd-2**: '+sd2.length+' **sdxl**: '+sdxl.length,color:getRandomColorDec()}
                ],
                components:[]
            }
            let basemodels = ['sd-1','sd-2','sdxl']
            for (const modeltype in basemodels){
                let filteredModels = models.filter(obj=>obj.base_model===basemodels[modeltype])
                let marr=[]
                for (const m in filteredModels){
                    let model = filteredModels[m]
                    marr.push(model.model_name)
                }
                if(marr.length>0){
                    let newdlg = {color:getRandomColorDec(),description:'**'+basemodels[modeltype]+' loras**:\n'+marr.join('\n')}
                    dialog.embeds.push(newdlg)
                }
            }
            return {messages:[dialog],files:[]}
        }
    },
    {
        name:'nightmarePromptGen',
        description:'Autocomplete prompts with nightmare prompt generator',
        permissionLevel:'all',
        aliases:['nightmare'],
        prefix:'!',
        command: async(args,msg)=>{
            // Requires custom node https://github.com/gogurtenjoyer/nightmare-promptgen
            // Do NOT allow repo_id to be directly set by user or you deserve what happens next
            // OG 500mb model:  cactusfriend/nightmare-invokeai-prompts
            // 1.5gb model:     cactusfriend/nightmare-promptgen-XL
            let options = parseArgs(args,{})
            let parsedOptions = {
                prompt:options._.join(' '),
                temp:options.temp??1.8,
                top_k:options.top_k??40,
                top_p:options.top_p??0.9,
                repo_id:'cactusfriend/nightmare-invokeai-prompts'
            }
            let response = await invoke.nightmarePromptGen(null,parsedOptions)
            let newMsg = {
                content:':brain: **Generated prompts:**',
                embeds:[
                ]
            }
            for (let answer in response){
                newMsg.embeds.push({description:response[answer].prompt,color:getRandomColorDec()})
            }
            return {messages:[newMsg],files:[]}
        }
    },
    {
        name:'load',
        description:'Load a job template from an uploaded image',
        permissionLevel:'all',
        aliases:['load'],
        prefix:'!',
        command: async(args,msg)=>{
            // get image metadata, show a frame similar to an image result with the controls
            msg.addReaction('🫡') // salute emoji
            let result
            let imgres = await extractImageAndUrlFromMessageOrReply(msg)
            if(!imgres||!imgres?.img){return {error:'No compatible image found'}}
            let meta = await exif.load(imgres.img)
            if(Object.keys(meta)?.length===0){
                debugLog('Incompatible image found')
                return {error:'Incompatible image found, missing metadata'}
            }
            result = {
                images:[
                    {
                        buffer:imgres.img,
                        name:extractFilenameFromUrl(imgres.url)
                    }
                ]
            }
            return returnMessageResult(msg,result)
        }
    }
]

// generate simple lookup array of all command aliases with prefixes
let prefixes=[]
commands.forEach(c=>{c.aliases.forEach(a=>{prefixes.push(c.prefix+a)})})

parseMsg=async(msg)=>{
    // normalise values between responses in channel and DM
    let userid = msg.member?.id||msg.author?.id
    let username = msg.user?.username||msg.member?.username||msg.author?.username
    let channelid = msg.channel?.id
    let guildid = msg.guildID||'DM'
    if(!auth.check(userid,guildid,channelid)){return} // if not authorised, ignore
    if(msg.length===0||msg.content.length===0){return} // if empty message (or just an image) ignore
    let firstword = msg.content.split(' ')[0].toLowerCase()
    if(prefixes.includes(firstword)){
        commands.forEach(c=>{
            c.aliases.forEach(async a=>{
                if(firstword===c.prefix+a){
                    let args=msg.content.split(' ')
                    args.shift() // only pass on the message without the prefix and command
                    // check permissionLevel
                    switch(c.permissionLevel){
                        case 'all':{break} // k fine
                        case 'admin':{
                            if(parseInt(userid)!==config.adminID){
                                log('Denied admin command for '+username)
                                return
                            }
                            break
                        }
                    }
                    log(c.name+' triggered by '+username+' in '+msg.channel.name??channelid+' ('+guildid+')')
                    try{
                        let result = await c.command(args,msg)
                        let messages = result?.messages
                        let files = result?.files
                        let error = result?.error
                        if(error){
                            log('Error: '.bgRed+' '+error)
                            chat(channelid,{content:'<@'+userid+'>', embeds:[{description:':warning: '+error,color:getRandomColorDec()}]})
                            return
                        }
                        if(!Array.isArray(messages)){messages=[messages]}
                        if(!Array.isArray(files)){files=[files]}
                        // unpack messages array and send each msg seperately
                        // if we have a file for each message, pair them up
                        // if we have multi messages and 1 file, attach to first message only
                        // todo If there are more files then there are messages attempt to bundle all files on first message
                        messages.forEach(message=>{
                            let file
                            if(files.length>0)file=files.shift() // grab the top file
                            if(message&&file){
                                chat(channelid,message,file) // Send message with attachment
                            }else if(message){
                                chat(channelid,message) // Send message, no attachment
                            }
                        })
                    } catch (err) {
                        log(err)
                    }
                }
            })
        })
    }
}

returnMessageResult = async(msg,result)=>{
    // generic response function for invoke results or errors
    if(result.error){return {error:result.error}}
    messages=[];files=[];error=null
    if(result?.images){
        for (const i in result.images){
            let image=result.images[i]
            let meta=await exif.load(image.buffer)
            message = imageResultMessage(msg.member?.id||msg.author?.id,image,result,meta)
            if(msg.id){
                //debugLog(msg)
                message.messageReference={message_id:msg.id}
            }
            messages.push(message)
            files.push({file:image.buffer,name:image.name})
        }
    }else if(result?.messages?.length>0){
        for (const m in result.messages){
            messages.push(m)
        }
    }
    return {
        messages:messages,
        files:files,
        error:error
    }
}

extractImageBufferFromMessage = async (msg)=>{
    // extract a single image buffer from a message
    let buf=null
    for (const a of msg.attachments){
        let validMimetypes=['image/png','image/jpeg','image/jpg','image/webp','image/svg']
        if(validMimetypes.includes(a.content_type)){
            buf = await urlToBuffer(a.proxy_url)
            if(['image/webp','image/svg'].includes(a.content_type)){buf = await imageEdit.convertToPng(buf)}
            break
        }
    }
    return buf
}

extractImageBuffersFromMessage = async (msg)=>{
    // extract multiple buffers from message as an array
    let buf=null
    let bufArr=[]
    for (const a of msg.attachments){
        let validMimetypes=['image/png','image/jpeg','image/jpg','image/webp','image/svg']
        if(validMimetypes.includes(a.content_type)){
            buf = await urlToBuffer(a.proxy_url)
            if(['image/webp','image/svg'].includes(a.content_type)){buf = await imageEdit.convertToPng(buf)}
            bufArr.push(buf)
        }
    }
    return bufArr
}

extractImageUrlFromMessage = async (msg)=>{
    // extract a single image url from a message
    for (const a of msg.attachments){
        let validMimetypes=['image/png','image/jpeg','image/webp']
        if(validMimetypes.includes(a.content_type)){
            return a.proxy_url
        }
    }
}

extractImageUrlsFromMessage = async (msg)=>{
    // extract an array of image urls from a message
    let imgArr=[]
    for (const a of msg.attachments){
        let validMimetypes=['image/png','image/jpeg','image/webp']
        if(validMimetypes.includes(a.content_type)){
            imgArr.push(a.proxy_url)
        }
    }
    return imgArr
}

extractMetadataFromMessage = async (msg)=>{
    if(messageHasImageAttachments(msg)){
        buf = await extractImageBufferFromMessage(msg)
        meta = await exif.load(buf)
        return meta
    } else {
        return null
    }
}

messageHasImageAttachments = (msg)=>{
    // return true or false
    if(msg.attachments?.length>0){
        for (const a of msg.attachments){
            let validMimetypes=['image/png','image/jpeg','image/webp']
            if(validMimetypes.includes(a.content_type)){return true}
        }
        return false
    }else{return false}
}

extractImageAndUrlFromMessageOrReply = async(msg)=>{
    // extract a single image buffer and url from a message or reply
    let img,url
    if(messageHasImageAttachments(msg)){
        img = await extractImageBufferFromMessage(msg)
        url = await extractImageUrlFromMessage(msg)
        debugLog('Extracted image attachment from message '+url)
    } else if(msg.messageReference?.messageID) {
        let sourcemsg = await bot.getMessage(msg.channel.id, msg.messageReference.messageID)
        if(messageHasImageAttachments(sourcemsg)){
            img = await extractImageBufferFromMessage(sourcemsg)
            url = await extractImageUrlFromMessage(sourcemsg)
            debugLog('Extracted image attachment from message reply '+url)
        }
    } else {
        img=null
        url=null
    }
    return {img,url}
}

extractImagesAndUrlsFromMessageOrReply = async(msg)=>{
    // extract multiple image buffers and urls from a message or reply
    let imgs,urls = []
    if(messageHasImageAttachments(msg)){
        imgs = await extractImageBuffersFromMessage(msg)
        urls = await extractImageUrlsFromMessage(msg)
        //debugLog('Extracted image attachments from message:')
        //debugLog(urls)
    } else if(msg.messageReference?.messageID) {
        let sourcemsg = await bot.getMessage(msg.channel.id, msg.messageReference.messageID)
        if(messageHasImageAttachments(sourcemsg)){
            imgs = await extractImageBuffersFromMessage(sourcemsg)
            urls = await extractImageUrlsFromMessage(sourcemsg)
            //debugLog('Extracted image attachments from message reply:')
            //debugLog(urls)
        }
    } else {
        imgs=[]
        urls=[]
    }
    const result = urls.map((url, index) => {
        return { url: url, img: imgs[index] }
    })
    return result
}

getAvatarUrl = async(userId)=>{
    let user = await bot.users.get(userId)
    let avatarHash = user.avatar
    let avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=512`
    return avatarUrl
}

imageResultMessage = (userid,img,result,meta)=>{
    //debugLog('debug imageresultmessage')
    //debugLog(meta)
    //debugLog(result)
    let p=meta?.invoke?.prompt
    //if(result.job.negative_prompt){p=p+' ['+result.job.negative_prompt+']'}
    let t=''
    if(meta.invoke?.cost){t+=' :coin: '+meta.invoke.cost}
    if(img.width&&img.height){t+=' :straight_ruler: '+img.width+'x'+img.height}
    //if(img.genWidth&&img.genHeight){t+=' :triangle_ruler: '+img.genWidth+'x'+img.genHeight}
    if(meta.invoke?.steps){t+=' :recycle: '+meta.invoke.steps}
    if(meta.invoke?.scheduler){t+=' :eye: '+meta.invoke.scheduler}
    if(meta.invoke?.seed){t+=' :seedling: '+meta.invoke.seed}
    if(meta.invoke?.scale){t+=' :scales: '+meta.invoke.scale}
    if(meta.invoke?.model){t+=' :floppy_disk: '+meta.invoke.model?.model_name}
    if(meta.invoke?.clipskip){t+=' :clipboard: '+meta.invoke.clipskip}
    if(meta.invoke?.strength){t+=' :muscle: '+meta.invoke.strength}
    if(meta.invoke?.lscale&&meta.invoke?.lscale!==1){t+=' :mag_right: '+meta.invoke.lscale}
    if(meta.invoke?.loras?.length>0){
        t+=' :pill: '
        for (const l in meta.invoke?.loras){t+=meta.invoke.loras[l].lora.model_name+'('+meta.invoke.loras[l].weight+') '}
    }
    if(meta.invoke?.inputImageUrl){t+=' :paperclip: [img]('+meta.invoke.inputImageUrl+')'}
    if(meta.invoke?.control){t+=' :video_game: '+meta.invoke.control}
    if(meta.invoke?.ipamodel){t+=' '+meta.invoke.ipamodel}
    if(meta.invoke?.controlweight){t+=',w:'+meta.invoke.controlweight}
    if(meta.invoke?.controlstart){t+=',s:'+meta.invoke.controlstart}
    if(meta.invoke?.controlend){t+=',e:'+meta.invoke.controlend}
    if(meta.invoke?.facemask){t+=' :performing_arts: facemask'}
    if(meta.invoke?.invert){t+=' inverted'}
    if(meta.invoke?.hrf){t+=' :telescope: hrf'}
    if(meta.invoke?.hrfwidth){t+=' '+meta.invoke.hrfwidth+'x'}
    if(meta.invoke?.hrfheight){t+=meta.invoke.hrfheight}
    let colordec=getRandomColorDec()
    let newmsg = {
        content:':brain: <@'+userid+'>',
        embeds:[
            {
                color: colordec,
                description:p,
                inline:true
            },
            {
                color: colordec,
                description:t,
                inline:true
            }
        ],
        components:[
            {type: 1,components:[
                {type:2,style:3,label:'Refresh',custom_id:'refresh',emoji:{name:'🎲',id:null}},
                {type:2,style:1,label:'Edit Prompt',custom_id:'editPrompt',emoji:{name:'✏️',id:null},disabled:false},
                {type:2,style:2,label:'Random',custom_id:'editPromptRandom',emoji:{name:'🔀',id:null},disabled:false},
                {type:2,style:1,label:'Tweak',custom_id:'tweak',emoji:{name:'🧪',id:null},disabled:false},
                {type:2,style:4,label:'No',custom_id:'remove',emoji:{name:'🗑️',id:null},disabled:false}
            ]}
        ],
        allowed_mentions:{users:[userid]}
    }
    // if controlnet is enabled, allow dropdown menu for controlweight changes
    let cnwos = [0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100]
    let cnwos2 = [...cnwos,125,150,175,200]
    if(meta.invoke?.inputImageUrl&&meta.invoke?.control&&meta.invoke?.controlweight){
        let cnwo = []
        for (const i in cnwos2){
            let o = cnwos2[i]
            let od = (parseFloat(meta.invoke.controlweight).toFixed(2)===(o/100).toFixed(2)) ? 'Selected' : null
            cnwo.push({value:(o/100).toFixed(2),description:od,label:o+'%'})
        }
        newmsg.components.push({type:1,components:[{type: 3,custom_id:'edit-x-controlweight',placeholder:'Controlnet weight '+(parseFloat(meta.invoke.controlweight)*100).toFixed(0)+'%',min_values:1,max_values:1,options:cnwo}]})
    }
    // same for controlstart
    if(meta.invoke?.inputImageUrl&&meta.invoke?.control&&meta.invoke?.controlstart){
        let cnwo = []
        for (const i in cnwos){
            let o = cnwos[i]
            let od = (parseFloat(meta.invoke.controlstart).toFixed(2)===(o/100).toFixed(2)) ? 'Selected' : null
            cnwo.push({value:(o/100).toFixed(2),description:od,label:o+'%'})
        }
        newmsg.components.push({type:1,components:[{type: 3,custom_id:'edit-x-controlstart',placeholder:'Controlnet start at '+(parseFloat(meta.invoke.controlstart)*100).toFixed(0)+'%',min_values:1,max_values:1,options:cnwo}]})
    }
    // same for controlend
    if(meta.invoke?.inputImageUrl&&meta.invoke?.control&&meta.invoke?.controlend){
        let cnwo = []
        for (const i in cnwos){
            let o = cnwos[i]
            let od = (parseFloat(meta.invoke.controlend).toFixed(2)===(o/100).toFixed(2)) ? 'Selected' : null
            cnwo.push({value:(o/100).toFixed(2),description:od,label:o+'%'})
        }
        newmsg.components.push({type:1,components:[{type: 3,custom_id:'edit-x-controlend',placeholder:'Controlnet end at '+(parseFloat(meta.invoke.controlend)*100).toFixed(0)+'%',min_values:1,max_values:1,options:cnwo}]})
    }
    /*
    // get all available controlnet modes
    if(meta.invoke?.inputImageUrl&&meta.invoke?.control){
        let cnwo = []
        // todo detect controltype names and availability from api
        //let controltypes = ['ipa','i2l','depth','canny','openpose','qrCodeMonster_v20']
        let controltypes = await invoke.allUniqueControlnetsAvailable() // no async here, lets just move all this shit out to a component command rather then rework as async
        controltypes = controltypes.map(o=>o.model_name)
        // todo filter by base model, only show models relevant to current render
        debugLog(controltypes)
        for (const i in controltypes){
            let o = controltypes[i]
            let od = (meta.invoke.control===o) ? 'Selected' : null
            cnwo.push({value:o,label:od,label:o})
        }
        newmsg.components.push({type:1,components:[{type: 3,custom_id:'edit-x-control',placeholder:'Controlnet Type',min_values:1,max_values:1,options:cnwo}]})
    }
    */
    return newmsg
}

help=()=>{
  var helpTitles=['let\'s get wierd','help me help you','help!','wait, what ?']
  shuffle(helpTitles)
  var helpMsgObject={
    content: '',
    embeds: [
        {
        type: 'rich',
        title: helpTitles[0],
        description: '```diff\n-| To create art: \n+| /dream\n+| !dream *your idea here*\n+| /random\n\n-| For text overlays & memes:\n+| /text\n+| !text words (reply to image result)\n\n-| Accounting:\n+| /balance\n+| /recharge\n+| !gift 10 @whoever\n\n-| Advanced customisation:\n+| /models\n+| /embeds\n+| !randomisers\n``` ```yaml\nSee these link buttons below for more commands and info```',
        color: getRandomColorDec()
        }
    ],
    components: [
        {type: 1, components:[
        {type: 2, style: 5, label: "Intro Post", url:'https://peakd.com/@ausbitbank/our-new-stable-diffusion-discord-bot', emoji: { name: 'hive', id: '1110123056501887007'}, disabled: false },
        {type: 2, style: 5, label: "Github", url:'https://github.com/ausbitbank/stable-diffusion-discord-bot', emoji: { name: 'Github', id: '1110915942856282112'}, disabled: false },
        {type: 2, style: 5, label: "Commands", url:'https://github.com/ausbitbank/stable-diffusion-discord-bot/blob/main/commands.md', emoji: { name: 'Book_Accessibility', id: '1110916595863269447'}, disabled: false },
        //{type: 2, style: 5, label: "Invite to server", url:'https://discord.com/oauth2/authorize?client_id='+discord.bot.application.id+'&scope=bot&permissions=124992', emoji: { name: 'happy_pepe', id: '1110493880304013382'}, disabled: false },
        {type: 2, style: 5, label: "Privacy Policy", url:'https://gist.github.com/ausbitbank/cd8ba9ea6aa09253fcdcdfad36b9bcdd', emoji: { name: '📜', id: null}, disabled: false },
        ]}
    ] 
  }
  return helpMsgObject
}

module.exports = {
    messageCommands:{
        commands,
        prefixes,
        parseMsg,
        extractImageBufferFromMessage,
        extractImageBuffersFromMessage,
        extractMetadataFromMessage,
        extractImageUrlFromMessage,
        extractImageUrlsFromMessage,
        messageHasImageAttachments,
        returnMessageResult
    }
}
