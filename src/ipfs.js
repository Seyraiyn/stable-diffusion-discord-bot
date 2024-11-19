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
    //debugLog(`IPFS: Attempting to retrieve content with CID: ${cid}`)
    try {
        let stream = await fs.cat(cid)
        let chunks = []
        for await (const chunk of stream){
            chunks.push(chunk)
            //debugLog(`IPFS: Received chunk of size: ${chunk.length} bytes`)
        }
        const result = Buffer.concat(chunks)
        debugLog(`IPFS: Successfully retrieved content, total size: ${result.length} bytes`)
        return result
    } catch (err) {
        debugLog(`IPFS: Error retrieving content: ${err.message}`)
        throw err
    }
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
    const { FsBlockstore } = await import('blockstore-fs')
    const { FsDatastore } = await import('datastore-fs')
    const { tcp } = await import('@libp2p/tcp')
    const { noise } = await import('@chainsafe/libp2p-noise')
    const { yamux } = await import('@chainsafe/libp2p-yamux')
    const { bootstrap } = await import('@libp2p/bootstrap')
    const { identifyService } = await import('libp2p/identify')
    
    const blockstore = new FsBlockstore('config/ipfs/block-store')
    const datastore = new FsDatastore('config/ipfs/data-store')
    
    helia = await createHelia({
        datastore,
        blockstore,
        libp2p: {
            addresses: {
                listen: [
                    '/ip4/0.0.0.0/tcp/4001',
                    '/ip6/::/tcp/4001'
                ],
                announce: [
                    `/ip4/${config.ipfs.ip}/tcp/4001`
                ]
            },
            services: {
                identify: identifyService()
            },
            connectionManager: {
                maxConnections: 50,
                minConnections: 10,
                autoDialInterval: 30000,
            },
            transports: [tcp()],
            streamMuxers: [yamux()],
            connectionEncryption: [noise()],
            peerDiscovery: [
                bootstrap({
                    list: [
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
                    ]
                })
            ]
        }
    })
    fs = unixfs(helia)
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