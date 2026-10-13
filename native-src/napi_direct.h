/*
 * napi_direct.h
 * Runtime-direct N-API binding for the HarmonyOS Electron host.
 *
 * On device, the OHOS system libace_napi.z.so (loaded RTLD_GLOBAL by the
 * ArkTS runtime, NAPI version 8) shadows the napi_* symbols of libelectron.so
 * (RTLD_LOCAL, NAPI version 10) in the musl global search scope. A plain
 * import therefore binds to the wrong N-API implementation and every call
 * fails with napi_pending_exception (10) because the env belongs to a
 * different VM.
 *
 * This header resolves the napi_* functions explicitly from libelectron.so
 * via dlsym (RTLD_NOLOAD reuses the already-loaded instance) and forwards
 * every call through function pointers. On desktop builds where no
 * libelectron.so exists, it falls back to RTLD_DEFAULT, which is the normal
 * symbol source there.
 */
#ifndef NAPI_DIRECT_H
#define NAPI_DIRECT_H

#include <node_api.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>

#define ND_LOG(...) do { \
  FILE* _ndfp = fopen("/data/storage/el2/base/files/localminidrama-desktop/addon-reg.log", "a"); \
  if (_ndfp) { fprintf(_ndfp, __VA_ARGS__); fclose(_ndfp); } \
} while (0)

#define ND_LIST \
  ND_X(get_version, (napi_env env, uint32_t* result), (env, result)) \
  ND_X(create_function, (napi_env env, const char* utf8name, size_t length, napi_callback cb, void* data, napi_value* result), (env, utf8name, length, cb, data, result)) \
  ND_X(set_named_property, (napi_env env, napi_value object, const char* utf8name, napi_value value), (env, object, utf8name, value)) \
  ND_X(get_cb_info, (napi_env env, napi_callback_info cbinfo, size_t* argc, napi_value* argv, napi_value* this_arg, void** data), (env, cbinfo, argc, argv, this_arg, data)) \
  ND_X(create_string_utf8, (napi_env env, const char* str, size_t length, napi_value* result), (env, str, length, result)) \
  ND_X(create_object, (napi_env env, napi_value* result), (env, result)) \
  ND_X(create_array, (napi_env env, napi_value* result), (env, result)) \
  ND_X(set_element, (napi_env env, napi_value object, uint32_t index, napi_value value), (env, object, index, value)) \
  ND_X(create_double, (napi_env env, double value, napi_value* result), (env, value, result)) \
  ND_X(create_int64, (napi_env env, int64_t value, napi_value* result), (env, value, result)) \
  ND_X(get_value_double, (napi_env env, napi_value value, double* result), (env, value, result)) \
  ND_X(get_value_bool, (napi_env env, napi_value value, bool* result), (env, value, result)) \
  ND_X(get_value_string_utf8, (napi_env env, napi_value value, char* buf, size_t bufsize, size_t* result), (env, value, buf, bufsize, result)) \
  ND_X(typeof, (napi_env env, napi_value value, napi_valuetype* result), (env, value, result)) \
  ND_X(get_undefined, (napi_env env, napi_value* result), (env, result)) \
  ND_X(get_null, (napi_env env, napi_value* result), (env, result)) \
  ND_X(throw, (napi_env env, napi_value error), (env, error)) \
  ND_X(throw_type_error, (napi_env env, const char* code, const char* msg), (env, code, msg)) \
  ND_X(create_error, (napi_env env, napi_value code, napi_value msg, napi_value* result), (env, code, msg, result)) \
  ND_X(create_external, (napi_env env, void* data, napi_finalize finalize_cb, void* finalize_hint, napi_value* result), (env, data, finalize_cb, finalize_hint, result)) \
  ND_X(get_value_external, (napi_env env, napi_value value, void** result), (env, value, result)) \
  ND_X(is_buffer, (napi_env env, napi_value value, bool* result), (env, value, result)) \
  ND_X(is_typedarray, (napi_env env, napi_value value, bool* result), (env, value, result)) \
  ND_X(is_arraybuffer, (napi_env env, napi_value value, bool* result), (env, value, result)) \
  ND_X(get_buffer_info, (napi_env env, napi_value value, void** data, size_t* length), (env, value, data, length)) \
  ND_X(get_typedarray_info, (napi_env env, napi_value value, napi_typedarray_type* type, size_t* length, void** data, napi_value* arraybuffer, size_t* byte_offset), (env, value, type, length, data, arraybuffer, byte_offset)) \
  ND_X(get_arraybuffer_info, (napi_env env, napi_value arraybuffer, void** data, size_t* byte_length), (env, arraybuffer, data, byte_length)) \
  ND_X(create_buffer_copy, (napi_env env, size_t length, const void* data, void** result_data, napi_value* result), (env, length, data, result_data, result)) \
  ND_X(coerce_to_string, (napi_env env, napi_value value, napi_value* result), (env, value, result)) \

static int g_nd_inited = 0;

#define ND_X(name, params, args) \
  static napi_status (*p_nd_##name) params = NULL; \
  static napi_status nd_##name params { \
    if (p_nd_##name == NULL) return napi_generic_failure; \
    return p_nd_##name args; \
  }
ND_LIST
#undef ND_X

static void nd_init(void) {
  void* h = NULL;
  const char* src = "none";
  int missing = 0;
  if (g_nd_inited) return;
  g_nd_inited = 1;
  h = dlopen("libelectron.so", RTLD_LAZY | RTLD_NOLOAD);
  if (h != NULL) {
    src = "libelectron.so:noload";
  } else {
    h = dlopen("libelectron.so", RTLD_LAZY);
    if (h != NULL) {
      src = "libelectron.so:load";
    } else {
      h = RTLD_DEFAULT;
      src = "rtld_default";
    }
  }
#define ND_X(name, params, args) \
  p_nd_##name = (napi_status (*) params)dlsym(h, "napi_" #name); \
  if (p_nd_##name == NULL) missing++;
  ND_LIST
#undef ND_X
  ND_LOG("nd_init: source=%s missing=%d\n", src, missing);
}

/* Redirect every napi_* call site in the including file to the forwarders. */
#define napi_get_version nd_get_version
#define napi_create_function nd_create_function
#define napi_set_named_property nd_set_named_property
#define napi_get_cb_info nd_get_cb_info
#define napi_create_string_utf8 nd_create_string_utf8
#define napi_create_object nd_create_object
#define napi_create_array nd_create_array
#define napi_set_element nd_set_element
#define napi_create_double nd_create_double
#define napi_create_int64 nd_create_int64
#define napi_get_value_double nd_get_value_double
#define napi_get_value_bool nd_get_value_bool
#define napi_get_value_string_utf8 nd_get_value_string_utf8
#define napi_typeof nd_typeof
#define napi_get_undefined nd_get_undefined
#define napi_get_null nd_get_null
#define napi_throw nd_throw
#define napi_throw_type_error nd_throw_type_error
#define napi_create_error nd_create_error
#define napi_create_external nd_create_external
#define napi_get_value_external nd_get_value_external
#define napi_is_buffer nd_is_buffer
#define napi_is_typedarray nd_is_typedarray
#define napi_is_arraybuffer nd_is_arraybuffer
#define napi_get_buffer_info nd_get_buffer_info
#define napi_get_typedarray_info nd_get_typedarray_info
#define napi_get_arraybuffer_info nd_get_arraybuffer_info
#define napi_create_buffer_copy nd_create_buffer_copy
#define napi_coerce_to_string nd_coerce_to_string

#endif /* NAPI_DIRECT_H */
