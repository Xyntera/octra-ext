#!/bin/bash
set -e
cd "$(dirname "$0")/../../pvac"

emcc pvac_c_api.cpp \
  -I include \
  -I . \
  -std=c++17 \
  -O2 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="PvacModule" \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=67108864 \
  -s STACK_SIZE=5242880 \
  -s NO_FILESYSTEM=1 \
  -s SINGLE_FILE=0 \
  -s EXPORTED_FUNCTIONS='["_pvac_default_params","_pvac_free_params","_pvac_keygen_from_seed","_pvac_enc_value_seeded","_pvac_enc_zero_seeded","_pvac_dec_value","_pvac_dec_value_fp","_pvac_ct_add","_pvac_ct_sub","_pvac_commit_ct","_pvac_make_zero_proof_bound","_pvac_verify_zero_bound","_pvac_make_zero_proof","_pvac_verify_zero","_pvac_pedersen_commit","_pvac_make_range_proof","_pvac_verify_range","_pvac_make_aggregated_range_proof","_pvac_verify_aggregated_range","_pvac_serialize_cipher","_pvac_deserialize_cipher","_pvac_serialize_pubkey","_pvac_deserialize_pubkey","_pvac_serialize_seckey","_pvac_deserialize_seckey","_pvac_serialize_zero_proof","_pvac_deserialize_zero_proof","_pvac_serialize_range_proof","_pvac_deserialize_range_proof","_pvac_serialize_agg_range_proof","_pvac_deserialize_agg_range_proof","_pvac_free_cipher","_pvac_free_pubkey","_pvac_free_seckey","_pvac_free_zero_proof","_pvac_free_range_proof","_pvac_free_agg_range_proof","_pvac_free_bytes","_pvac_aes_kat","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["getValue","setValue","HEAPU8","HEAPU32","UTF8ToString","stringToUTF8"]' \
  -o ../src/wasm/pvac.js

echo "✅ WASM built → src/wasm/pvac.js + src/wasm/pvac.wasm"
