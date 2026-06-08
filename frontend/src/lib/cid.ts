const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

function base58Decode(input: string): Uint8Array {
  const bytes = [0]
  for (const char of input) {
    const value = BASE58_ALPHABET.indexOf(char)
    if (value < 0) throw new Error(`Caractere inválido em CID: ${char}`)
    let carry = value
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58
      bytes[i] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (const char of input) {
    if (char !== '1') break
    bytes.push(0)
  }
  return new Uint8Array(bytes.reverse())
}

function base32Decode(input: string): Uint8Array {
  const lower = input.toLowerCase()
  const bytes: number[] = []
  let buffer = 0
  let bitsLeft = 0
  for (const char of lower) {
    const value = BASE32_ALPHABET.indexOf(char)
    if (value < 0) throw new Error(`Caractere inválido em CIDv1: ${char}`)
    buffer = (buffer << 5) | value
    bitsLeft += 5
    if (bitsLeft >= 8) {
      bitsLeft -= 8
      bytes.push((buffer >> bitsLeft) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

function base32Encode(bytes: Uint8Array): string {
  let result = ''
  let buffer = 0
  let bitsLeft = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bitsLeft += 8
    while (bitsLeft >= 5) {
      bitsLeft -= 5
      result += BASE32_ALPHABET[(buffer >> bitsLeft) & 31]
    }
  }
  if (bitsLeft > 0) {
    result += BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 31]
  }
  return result
}

function base58Encode(bytes: Uint8Array): string {
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8
      digits[i] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  let result = ''
  for (const byte of bytes) {
    if (byte !== 0) break
    result += '1'
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]]
  }
  return result
}

export function cidToBytes32(cid: string): string {
  if (cid.startsWith('b') || cid.startsWith('B')) {
    // CIDv1: multibase prefix 'b' = base32 lowercase
    // Structure: version(1) + codec(1) + multihash_code(1) + digest_length(1) + digest(32)
    const decoded = base32Decode(cid.slice(1))
    if (decoded.length < 36) throw new Error('CIDv1 inválido: comprimento inesperado')
    const hash = decoded.slice(4, 36)
    return '0x' + Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  // CIDv0: base58(0x12 0x20 [32 bytes])
  const decoded = base58Decode(cid)
  if (decoded.length !== 34) throw new Error('CID inválido: comprimento inesperado')
  const hash = decoded.slice(2)
  return '0x' + Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function bytes32ToCid(bytes32: string): string {
  const hex = bytes32.startsWith('0x') ? bytes32.slice(2) : bytes32
  if (hex.length !== 64) throw new Error('bytes32 inválido: comprimento inesperado')
  const hashBytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
  // CIDv1 with raw codec (0x55) and sha2-256 (0x12, 0x20)
  const cidBytes = new Uint8Array([0x01, 0x55, 0x12, 0x20, ...hashBytes])
  return 'b' + base32Encode(cidBytes)
}

export function bytes32ToCidV0(bytes32: string): string {
  const hex = bytes32.startsWith('0x') ? bytes32.slice(2) : bytes32
  if (hex.length !== 64) throw new Error('bytes32 inválido: comprimento inesperado')
  const hashBytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
  const cidBytes = new Uint8Array([0x12, 0x20, ...hashBytes])
  return base58Encode(cidBytes)
}
