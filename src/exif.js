const ExifReader = require('exifreader')
const sharp = require('sharp')
const {log,debugLog} = require('./utils.js')
const pngextract = require('png-chunks-extract')
const pngencode = require('png-chunks-encode')
const pngtext = require('png-chunk-text')



load=async(buf)=>{
    //buf = await modify(buf,'arty_meta','keyname','value')
    exif = ExifReader.load(buf)
    let width = exif['Image Width'].value
    let height = exif['Image Height'].value
    let results = {}
    // todo move this to invoke module after polish
    if(exif.invokeai_metadata&&exif.invokeai_graph){
        meta=JSON.parse(exif.invokeai_metadata.value)
        let seed = meta.seed
        let model = meta.model
        let clipskip = meta.clip_skip
        let loras=meta.loras
        let graph = JSON.parse(exif.invokeai_graph.value)
        let positive_prompt=meta.positive_prompt
        let negative_prompt=meta.negative_prompt
        let scale=meta.cfg_scale
        let steps=0
        let pixelSteps=0
        let genWidth=0
        let genHeight=0
        let lscale=1
        let controlnets=meta.controlnets
        let inputImageUrl=null
        let scheduler=meta.scheduler
        for (const i in graph.nodes){
            let n = graph.nodes[i]
            if(n.type==='noise'){
                genWidth=n.width
                genHeight=n.height
            }
            if(n.type==='t2l'){
                steps=steps+n.steps
                pixelSteps=pixelSteps+((genWidth*genHeight)*n.steps)
            }
            if(n.type==='lscale'){lscale=n.scale_factor}
            if(n.type==='l2l'){
                steps=steps+(n.steps*n.strength)
                pixelSteps=pixelSteps+(((genHeight*genWidth)*lscale)*(n.steps*n.strength))
            }
            if(n.type==='controlnet'){
                controlnets.push({controlnet:n.control_model,weight:n.control_weight,begin:n.begin_step_percent,end:n.end_step_percent,mode:n.control_mode,resize:n.resize_mode})
            }
        }
        let cost=(pixelSteps/7864320) // 1 normal 30 step 512x512 render to 1 coin
        if(exif.arty){
            let arty = JSON.parse(exif.arty.value)
            inputImageUrl=arty.inputImageUrl
        }
        cost = Math.round((cost + Number.EPSILON) * 1000) / 1000 // max 3 decimals, if needed
        results.invoke={
            positive_prompt,
            negative_prompt,
            pixelSteps,
            steps,
            width,
            height,
            genHeight,
            genWidth,
            loras,
            seed,
            cost,
            scheduler,
            model,
            scale,
            controlnets,
            inputImageUrl,
            clipskip
        }
    }
    //debugLog(results)
    return results
}

modify=async(buf,parent,key,value)=>{
    // load all the chunk data from the buffer
    let chunks = pngextract(buf)
    // find the tEXt chunks
    let textChunks = chunks.filter(chunk=>{
        return chunk.name === 'tEXt'
    }).map(chunk=>{
        return pngtext.decode(chunk.data)
    })
    newdata = {}
    newdata[key] = value
    dataAlreadyExists=()=>{
        d = textChunks.filter(c=>{return c.value===JSON.stringify(newdata)})
        if(d.length>0){return true}else{return false}
    }
    if(dataAlreadyExists()){
        debugLog('already existed in original png metadata')
    } else {
        debugLog('Splicing in new metadata')
        // splice in the new encoded tEXt chunk
        chunks.splice(-1,0,pngtext.encode(parent,JSON.stringify(newdata)))
    }
    // turn it all back into the original buffer format and return
    let output = pngencode(chunks)
    buf = Buffer.from(pngencode(chunks))
    return buf

}

module.exports={exif:{load,modify}}
