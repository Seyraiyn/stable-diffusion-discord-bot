// Track progress for a specific job, report to discord on changes
const {log,debugLog,sleep, getUUID, getRandomColorDec}=require('../utils.js')
const {resultCache}=require('../resultCache')

update = async(msg,batchid,creator)=>{
    // Increase interval between checks
    const INITIAL_INTERVAL = 1000; // 1 second
    const MAX_INTERVAL = 5000;     // 5 seconds
    let interval = INITIAL_INTERVAL;
    
    let error=false,done=false,statusmsg=null,cached=null,result=null,fails=0;
    
    while(!error && !done) {
        try {
            await sleep(interval);
            result = resultCache.get(batchid);
            
            // Exit early conditions
            if(['completed','failed','cancelled','canceled'].includes(result?.status)) {
                await msg.delete();
                return;
            }

            // Only update if there's meaningful progress change
            const newStatusMsg = returnProgressMessage(batchid,creator);
            if(!newStatusMsg) {
                fails++;
                if(fails > 3) {
                    await msg.delete();
                    return;
                }
                // Increase interval on fails
                interval = Math.min(interval * 1.5, MAX_INTERVAL);
                continue;
            }

            // Only edit message if content actually changed
            if(newStatusMsg && JSON.stringify(newStatusMsg) !== JSON.stringify(cached)) {
                cached = newStatusMsg;
                await msg.edit(newStatusMsg.msg, newStatusMsg.file);
            }

        } catch (err) {
            debugLog(err);
            error = true;
        }
    }
}

returnProgressMessage = (batchid,creator) =>{
    // Return a formatted discord message tracking progress for a specific batchid
    let err = false
    try {
        let r = resultCache.get(batchid)
        let content= ''//+batchid
        file=null
        filename=null
        if(r){
            switch(r.status){
                case('in_progress'):content=':green_circle: In progress';break
                case('pending'):content=':orange_circle: Pending';break
                case('failed'):content=':red_circle: Failed';break
                case('completed'):content=':tada: Completed';break
            }
            content+=' '
            if(r.hostname){content+=' on `'+r.hostname+'`'}
            content+='\n'
            if(creator?.discordid){
                content=`:brain: Requested by <@${creator.discordid}> \n${content}`
            }
            if(r.progress?.message!==undefined&&r.progress?.percentage!==undefined){
                let percent = (r.progress.percentage*100).toFixed(0) //(parseInt(r.progress?.step) / parseInt(r.progress?.total_steps))*100
                let message = r.progress.message
                content+=emoji(percent)+' '+message+' '+percent+'%'
            } else if(r.results.length>0 && r.results[r.results.length-1].type) {
                content = content + ':floppy_disk: ' + r.results[r.results.length-1].type + '\n'
            }
            /*
            if(r.progress.image!==undefined){
                // urlencode the dataURL to bypass discord restrictions on dataurls
                // still doesn't work, url is too big for discord reee
                imageurl='https://images.weserv.nl/?url='+encodeURIComponent(r.progress.image)
                shortener_url = "http://tinyurl.com/api-create.php"
                response = axios.get(shortener_url, params={"url": imageurl})
                content = content + '\n'
            }
            */
        let components = [{
            type:1,
            components:[{
                type:2,
                style:4,
                label:'Cancel',
                custom_id: `cancelBatch-${batchid}`,
                emoji:{name:'🗑️',id:null},
                disabled:false}]
            }]
        let msg = {embeds: [{description:content}],components:components}
        if(file){
            msg.embeds[0].thumbnail={url:'attachment://'+filename}
            return {msg,file}
        } else {return {msg:msg}}
        } else {return null}
    } catch (err) {throw(err)}
}


emoji = (percent,emojis=null)=>{
    if(percent===undefined||percent>100||percent===NaN) return ''
    emojiLibrary=[
        [':hourglass_flowing_sand:',':hourglass:'],
        ['🥚','🐣','🐤','🐔','🔥','🍗',':yum:'],
        [':clock12:',':clock1:',':clock2:',':clock3:',':clock4:',':clock5:',':clock6:',':clock7:',':clock8:',':clock9:',':clock10:',':clock11:'],
        [':baby:',':girl:',':woman:',':mirror_ball:',':heart_eyes:',':man_beard:',':kiss_woman_man:',':couple:',':ring:',':wedding:',':kiss_woman_man:',':bouquet:',':dove:',':red_car:',':airplane_departure:',':airplane:',':airplane_arriving:',':hotel:',':bed:',':smirk:',':eggplant:',':astonished:',':cherry_blossom:',':heart_on_fire:',':hushed:',':stuck_out_tongue:',':sweat_drops:',':sweat_smile:',':stuck_out_tongue_closed_eyes:',':stuck_out_tongue_winking_eye:',':sleeping:',':sleeping_accommodation:',':thermometer_face:',':nauseated_face:',':face_vomiting:',':pregnant_woman:',':pregnant_person:',':pregnant_man:',':ambulance:',':hospital:',':cold_sweat:',':face_exhaling:',':face_with_symbols_over_mouth:',':relieved:',':family_mwg:']
    ]
    if (!emojis){emojis=emojiLibrary[1]}
    const numEmojis = emojis.length
    const emojiIndex = Math.floor(percent * numEmojis)
    var emoji = emojis[emojiIndex]
    if(!emoji){emoji=emojis[emojis.length-1]}
    return emoji
}

module.exports = {
    progress:{
        update
    }
}
