const fs = require('fs')
const util = require('util')
const WebSocket = require('ws')
const uuid4 = require('uuid/v4')
const yargs = require('yargs')

async function loadImage(filename) {
    const readFileAsync = util.promisify(fs.readFile)
    return readFileAsync(filename)
}

function handshake(clientId, socket) {
    return new Promise((resolve, reject) => {
        socket.once('open', () => {
            console.log('WebSocket connected, sending handshake')
            socket.send(JSON.stringify({
                data: {
                    agent: `WebSocketCli/0.1.0 (node ${process.version})`,
                    clientId: clientId
                },
                op: 2
            }))
        })

        socket.once('message', (data) => {
            const res = JSON.parse(data)
            if (res.op != 2) {
                console.error('Received non-handshake response')
                reject('handshake failed')
            }

            console.info(`Session established, SessionId: ${res.data.sessionId}`)
            resolve(res.data.sessionId)
        })
    })
}

async function main(endpoint, filename) {
    console.log(`Reading image file: ${filename}`)
    const image = await loadImage(filename)

    console.log(`Connecting to endpoint: ${endpoint}`)
    const socket = new WebSocket(endpoint)

    socket.on('close', (code, reason) => {
        console.error(`Connection closed: ${code} ${reason}`)
        process.exit(-1)
    })

    const clientId = uuid4()
    const sessionId = await handshake(clientId, socket)

    socket.on('message', (data) => console.log(data))

    setInterval(() => socket.send(JSON.stringify({
        data: {
            sessionId: sessionId
        },
        op: 3
    })), 500)

    setTimeout(() => {
        console.info('Sending image recognition request')
        socket.send(JSON.stringify({
            data: {
                contentLength: image.length,
                contentType: 'image/jpeg'
            },
            op: 5
        }))
    }, 500)

    setTimeout(() => socket.send(JSON.stringify({
        op: 1
    })), 5000)
}

(function entry() {
    var args = yargs
        .alias('u', 'endpoint')
        .default('endpoint', 'ws://localhost:51997/api/v2/websocket')
        .alias('f', 'filename')
        .default('filename', 'image.jpg')
        .argv

    main(args.endpoint, args.filename)
})()
