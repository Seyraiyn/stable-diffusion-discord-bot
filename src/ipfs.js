// ipfs and libp2p functions
// https://helia.io/
// https://libp2p.io/
// https://github.com/ipfs-examples/helia-examples/blob/main/examples/helia-101/301-networking.js
// https://github.com/ipfs-examples/helia-examples/blob/main/examples/helia-cjs/index.js

const {log,debugLog,config} = require('./utils')
const {db,User,Pin}=require('./db.js')
let helia, fs

const add = async(fileBuffer,creator,flags=null)=>{
    // Add files to ipfs, save to Pin database, return object with info like cid,size,etc
    // Pin db requires cid,user,size,flags
    let usr = await User.findOne({where:{discordID:creator.discordid}})
    let user = usr.id
    let cid = await hash(fileBuffer)
    let size = Buffer.byteLength(fileBuffer)
    let [newpin,created] = await Pin.findOrCreate({where:{cid},defaults:{user,size,cid,flags}})
    let originalpinusr = await User.findOne({where:{id:newpin.user}})
    let result
    if(usr.id===originalpinusr.id){
        result = {description:'IPFS upload for '+usr.username,cid,size:newpin.size,flags:newpin.flags,createdAt:newpin.createdAt,user:newpin.user,id:newpin.id,created}
    } else {
        result = {description:'IPFS already pinned for '+originalpinusr.username,cid,size:originalpinusr.size,flags:originalpinusr.flags,createdAt:originalpinusr.createdAt,user:originalpinusr.user,id:originalpinusr.id,created}
    }
    //
    
    debugLog(result)
    return result
}

const remove = async(cid)=>{
    // remove from ipfs and Pin database
    // todo set x flag instead of delete
    let dbresult = await Pin.destroy({where:[{cid}]}) // works, local db entries removed
    let rmresult = await rm(cid) // todo not working, ipfs store still holds data
    let r = {dbresult,rmresult}
    debugLog(r)
    return r
}

const rm = async(cid)=>{
    // remove / unpin from ipfs store
    // todo not working
    //debugLog(fs)
    //let res = await fs.rm(cid)
    let res = await helia.blockstore.delete(cid)
    return res
}

const hash = async(fileBuffer)=>{
    // Add a file, return its cid
    const cid = await fs.addBytes(fileBuffer)
    return cid.toString()
}

const cat = async(cid)=>{
    debugLog('ipfs: get '+cid)
    let stream = await fs.cat(cid)
    let chunks = []
    for await (const chunk of stream){chunks.push(chunk)}
    return Buffer.concat(chunks)
}

const init = async()=>{
    // Add global.DOMException handling
    if (typeof global.DOMException === 'undefined') {
        const { DOMException } = await import('node-domexception')
        global.DOMException = DOMException
    }


    // Helia config
    const { createHelia } = await import('helia')
    const { unixfs } = await import('@helia/unixfs')
    // Blockstore is where we store the blocks that make up files
    const { FsBlockstore } = await import('blockstore-fs')
    const blockstore = new FsBlockstore('config/ipfs/block-store')
    // Application-specific data lives in the datastore
    const { FsDatastore } = await import('datastore-fs')
    const datastore = new FsDatastore('config/ipfs/data-store')
    // Disabled all libp2p customisation for now, let helia do it
    helia = await createHelia({datastore,blockstore,libp2p: {connectionManager: {maxConnections: 50,minConnections: 10}},})
    // Listen for new connections to peers
    helia.libp2p.addEventListener("libp2p peer:connect", (evt) => {
        const connection = evt.detail
        debugLog(`libp2p Connected to ${connection.toString()}`)
    })
    // Listen for new peer discovery events
    helia.libp2p.addEventListener('libp2p peer:discovery', (peerId) => {
        // No need to dial, autoDial is on
        debugLog('libp2p Discovered:', peerId.toString())
    })
    // Listen for peers disconnecting
    helia.libp2p.addEventListener("libp2p peer:disconnect", (evt) => {
        const connection = evt.detail
        debugLog(`libp2p Disconnected from ${connection.toCID().toString()}`)
    })
    fs = unixfs(helia)
    log('Initialized IPFS node with peer id '+helia.libp2p.peerId)
    //debugLog(helia)
    //debugLog(fs)
    //await stop(helia) // needed?
}

module.exports = {
    ipfs:{
        init,
        hash,
        cat,
        rm,
        add,
        remove,
        helia,
        fs
    }
}