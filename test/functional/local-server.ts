import type { Server } from 'node:http'
import type { Socket } from 'node:net'

const openServers = new Map<Server, Set<Socket>>()

/** Listen on a free local port and return the server's base URL. */
export async function listen(server: Server): Promise<string> {
  const sockets = new Set<Socket>()
  openServers.set(server, sockets)
  server.on('connection', (socket) => {
    sockets.add(socket)
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a TCP server address')
  }
  return `http://127.0.0.1:${address.port}`
}

/** Close every server started by listen, including connections that are still open. */
export async function closeServers(): Promise<void> {
  await Promise.all(
    Array.from(openServers, async ([server, sockets]) => {
      for (const socket of sockets) {
        socket.destroy()
      }
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      })
    }),
  )
  openServers.clear()
}
