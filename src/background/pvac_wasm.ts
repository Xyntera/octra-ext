// PVAC FHE WASM bridge
// pvac.js is loaded as a web-accessible resource

let _module: PvacModule | null = null;

interface PvacModule {
  _pvac_default_params(): number;
  _pvac_free_params(ptr: number): void;
  _pvac_keygen_from_seed(params: number, seed: number, outPub: number, outSec: number): number;
  _pvac_enc_value_seeded(params: number, pub: number, value: number, seed: number, out: number): number;
  _pvac_enc_zero_seeded(params: number, pub: number, seed: number, out: number): number;
  _pvac_dec_value(params: number, pub: number, sec: number, ct: number, out: number): number;
  _pvac_ct_add(params: number, a: number, b: number, out: number): number;
  _pvac_ct_sub(params: number, a: number, b: number, out: number): number;
  _pvac_serialize_cipher(ct: number, outLen: number): number;
  _pvac_deserialize_cipher(data: number, len: number): number;
  _pvac_serialize_pubkey(pub: number, outLen: number): number;
  _pvac_deserialize_pubkey(data: number, len: number): number;
  _pvac_serialize_seckey(sec: number, outLen: number): number;
  _pvac_deserialize_seckey(data: number, len: number): number;
  _pvac_free_cipher(ct: number): void;
  _pvac_free_pubkey(pub: number): void;
  _pvac_free_seckey(sec: number): void;
  _pvac_free_bytes(ptr: number, len: number): void;
  _pvac_make_zero_proof(params: number, pub: number, sec: number, ct: number, seed: number, out: number): number;
  _pvac_verify_zero(params: number, pub: number, ct: number, proof: number): number;
  _pvac_make_range_proof(params: number, pub: number, sec: number, ct: number, seed: number, lo: number, hi: number, out: number): number;
  _pvac_verify_range(params: number, pub: number, ct: number, proof: number, lo: number, hi: number): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPU8: Uint8Array;
  getValue(ptr: number, type: string): number;
  setValue(ptr: number, value: number, type: string): void;
  UTF8ToString(ptr: number): string;
  stringToUTF8(str: string, ptr: number, len: number): void;
}

export async function loadPvac(): Promise<PvacModule> {
  if (_module) return _module;

  // In extension context, load from web_accessible_resources
  const scriptUrl = chrome.runtime.getURL('wasm/pvac.js');

  // Dynamically import the Emscripten module
  const mod = await import(/* @vite-ignore */ scriptUrl);
  const factory = mod.default ?? mod;

  _module = await factory({
    locateFile: (f: string) => chrome.runtime.getURL(`wasm/${f}`),
  });

  return _module!;
}

// ── High-level helpers ────────────────────────────────────────────────────────

function writeBytes(m: PvacModule, data: Uint8Array): number {
  const ptr = m._malloc(data.length);
  m.HEAPU8.set(data, ptr);
  return ptr;
}

function readBytes(m: PvacModule, ptr: number, len: number): Uint8Array {
  return m.HEAPU8.slice(ptr, ptr + len);
}

export async function pvacKeygen(seedHex: string): Promise<{ pubHex: string; secHex: string }> {
  const m = await loadPvac();
  const params = m._pvac_default_params();

  const seedBytes = Buffer.from(seedHex.padEnd(64, '0').slice(0, 64), 'hex');
  const seedPtr = writeBytes(m, seedBytes);

  const pubPtrPtr = m._malloc(4);
  const secPtrPtr = m._malloc(4);

  const rc = m._pvac_keygen_from_seed(params, seedPtr, pubPtrPtr, secPtrPtr);
  if (rc !== 0) throw new Error(`pvac_keygen failed: ${rc}`);

  const pubPtr = m.getValue(pubPtrPtr, 'i32');
  const secPtr = m.getValue(secPtrPtr, 'i32');

  const lenPtr = m._malloc(4);

  const pubDataPtr = m._pvac_serialize_pubkey(pubPtr, lenPtr);
  const pubLen = m.getValue(lenPtr, 'i32');
  const pubHex = Buffer.from(readBytes(m, pubDataPtr, pubLen)).toString('hex');

  const secDataPtr = m._pvac_serialize_seckey(secPtr, lenPtr);
  const secLen = m.getValue(lenPtr, 'i32');
  const secHex = Buffer.from(readBytes(m, secDataPtr, secLen)).toString('hex');

  m._pvac_free_bytes(pubDataPtr, pubLen);
  m._pvac_free_bytes(secDataPtr, secLen);
  m._pvac_free_pubkey(pubPtr);
  m._pvac_free_seckey(secPtr);
  m._free(seedPtr); m._free(pubPtrPtr); m._free(secPtrPtr); m._free(lenPtr);
  m._pvac_free_params(params);

  return { pubHex, secHex };
}

export async function pvacEncrypt(pubHex: string, value: number): Promise<string> {
  const m = await loadPvac();
  const params = m._pvac_default_params();

  const pubBytes = Buffer.from(pubHex, 'hex');
  const pubBytesPtr = writeBytes(m, pubBytes);
  const pubPtr = m._pvac_deserialize_pubkey(pubBytesPtr, pubBytes.length);

  const seed = crypto.getRandomValues(new Uint8Array(32));
  const seedPtr = writeBytes(m, seed);

  const ctPtrPtr = m._malloc(4);
  const rc = m._pvac_enc_value_seeded(params, pubPtr, value, seedPtr, ctPtrPtr);
  if (rc !== 0) throw new Error(`pvac_encrypt failed: ${rc}`);

  const ctPtr = m.getValue(ctPtrPtr, 'i32');
  const lenPtr = m._malloc(4);
  const ctDataPtr = m._pvac_serialize_cipher(ctPtr, lenPtr);
  const ctLen = m.getValue(lenPtr, 'i32');
  const ctHex = Buffer.from(readBytes(m, ctDataPtr, ctLen)).toString('hex');

  m._pvac_free_bytes(ctDataPtr, ctLen);
  m._pvac_free_cipher(ctPtr);
  m._pvac_free_pubkey(pubPtr);
  m._free(pubBytesPtr); m._free(seedPtr); m._free(ctPtrPtr); m._free(lenPtr);
  m._pvac_free_params(params);

  return ctHex;
}

export async function pvacDecrypt(pubHex: string, secHex: string, ctHex: string): Promise<number> {
  const m = await loadPvac();
  const params = m._pvac_default_params();

  const pubBytes = Buffer.from(pubHex, 'hex');
  const secBytes = Buffer.from(secHex, 'hex');
  const ctBytes  = Buffer.from(ctHex, 'hex');

  const pubBytesPtr = writeBytes(m, pubBytes);
  const secBytesPtr = writeBytes(m, secBytes);
  const ctBytesPtr  = writeBytes(m, ctBytes);

  const pubPtr = m._pvac_deserialize_pubkey(pubBytesPtr, pubBytes.length);
  const secPtr = m._pvac_deserialize_seckey(secBytesPtr, secBytes.length);
  const ctPtr  = m._pvac_deserialize_cipher(ctBytesPtr, ctBytes.length);

  const outPtr = m._malloc(8); // uint64
  const rc = m._pvac_dec_value(params, pubPtr, secPtr, ctPtr, outPtr);
  if (rc !== 0) throw new Error(`pvac_decrypt failed: ${rc}`);

  const lo = m.getValue(outPtr, 'i32');
  const hi = m.getValue(outPtr + 4, 'i32');
  const value = lo + hi * 0x100000000;

  m._pvac_free_cipher(ctPtr);
  m._pvac_free_pubkey(pubPtr);
  m._pvac_free_seckey(secPtr);
  m._free(pubBytesPtr); m._free(secBytesPtr); m._free(ctBytesPtr); m._free(outPtr);
  m._pvac_free_params(params);

  return value;
}

export async function pvacAdd(pubHex: string, ctAHex: string, ctBHex: string): Promise<string> {
  const m = await loadPvac();
  const params = m._pvac_default_params();

  const pubBytes = Buffer.from(pubHex, 'hex');
  const aBytes   = Buffer.from(ctAHex, 'hex');
  const bBytes   = Buffer.from(ctBHex, 'hex');

  const pubBytesPtr = writeBytes(m, pubBytes);
  const aPtr_raw    = writeBytes(m, aBytes);
  const bPtr_raw    = writeBytes(m, bBytes);

  const pubPtr = m._pvac_deserialize_pubkey(pubBytesPtr, pubBytes.length);
  const aPtr   = m._pvac_deserialize_cipher(aPtr_raw, aBytes.length);
  const bPtr   = m._pvac_deserialize_cipher(bPtr_raw, bBytes.length);

  const outPtrPtr = m._malloc(4);
  const rc = m._pvac_ct_add(params, aPtr, bPtr, outPtrPtr);
  if (rc !== 0) throw new Error(`pvac_add failed: ${rc}`);

  const outPtr = m.getValue(outPtrPtr, 'i32');
  const lenPtr = m._malloc(4);
  const outDataPtr = m._pvac_serialize_cipher(outPtr, lenPtr);
  const outLen = m.getValue(lenPtr, 'i32');
  const outHex = Buffer.from(readBytes(m, outDataPtr, outLen)).toString('hex');

  m._pvac_free_bytes(outDataPtr, outLen);
  m._pvac_free_cipher(aPtr); m._pvac_free_cipher(bPtr); m._pvac_free_cipher(outPtr);
  m._pvac_free_pubkey(pubPtr);
  m._free(pubBytesPtr); m._free(aPtr_raw); m._free(bPtr_raw);
  m._free(outPtrPtr); m._free(lenPtr);
  m._pvac_free_params(params);

  return outHex;
}
