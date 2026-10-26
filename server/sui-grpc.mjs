// Sui's gRPC API through Tatum. Sui switched JSON-RPC off on mainnet, and Tatum's
// Sui gRPC gateway speaks native gRPC (HTTP/2), so the server connects with
// @grpc/grpc-js. Browsers can only speak gRPC-web, so relayGrpcWeb() translates a
// browser's unary gRPC-web call into a native call and back.
import * as grpc from '@grpc/grpc-js'
import { GrpcTransport } from '@protobuf-ts/grpc-transport'
import { tatumGrpcUrl } from './tatum-client.mjs'

// SUI_GRPC_TARGET=host:port (plaintext) points at a local node or test server.
function target(network) {
  if (process.env.SUI_GRPC_TARGET) return { host: process.env.SUI_GRPC_TARGET, credentials: grpc.credentials.createInsecure() }
  return { host: `${new URL(tatumGrpcUrl('sui', network)).hostname}:443`, credentials: grpc.credentials.createSsl() }
}

const keyMeta = () => ({ 'x-api-key': process.env.TATUM_API_KEY ?? '' })

// Transport for SuiGrpcClient on the server.
export function grpcTransport(network) {
  const { host, credentials } = target(network)
  return new GrpcTransport({ host, channelCredentials: credentials, meta: keyMeta() })
}

// gRPC-web binary framing: 1 flag byte (0x00 data, 0x80 trailers), 4-byte length, payload.
function frame(flag, payload) {
  const head = Buffer.alloc(5)
  head[0] = flag
  head.writeUInt32BE(payload.length, 1)
  return Buffer.concat([head, payload])
}

function trailers(code, message) {
  return frame(0x80, Buffer.from(`grpc-status:${code}\r\ngrpc-message:${encodeURIComponent(message ?? '')}\r\n`))
}

const clients = new Map()
function rawClient(network) {
  if (!clients.has(network)) {
    const { host, credentials } = target(network)
    clients.set(network, new grpc.Client(host, credentials))
  }
  return clients.get(network)
}

// `path` is "package.Service/Method"; `body` is the gRPC-web request body.
export function relayGrpcWeb(network, path, body, res) {
  const send = (chunks) => res.status(200).type('application/grpc-web+proto').send(Buffer.concat(chunks))
  if (body.length < 5 || body[0] !== 0 || body.readUInt32BE(1) !== body.length - 5) {
    return send([trailers(grpc.status.INVALID_ARGUMENT, 'Expected one binary gRPC-web message')])
  }
  const metadata = new grpc.Metadata()
  for (const [k, v] of Object.entries(keyMeta())) metadata.set(k, v)
  const id = (b) => b
  rawClient(network).makeUnaryRequest(`/${path}`, id, id, body.subarray(5), metadata, { deadline: Date.now() + 30000 }, (err, reply) => {
    if (err) return send([trailers(err.code ?? grpc.status.UNKNOWN, err.details || err.message)])
    send([frame(0, reply), trailers(grpc.status.OK, '')])
  })
}
