/*
 * better_sqlite3_sync.c
 * Synchronous N-API SQLite wrapper for HarmonyOS Electron host.
 * Replaces the raw-V8 better-sqlite3 addon (host libelectron.so exports
 * napi_* only, no V8 symbols). API surface covers the subset used by
 * LocalMiniDrama backend: open/close/exec/prepare/run/get/all/finalize.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include "napi_direct.h"
#include <sqlite3.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define SYNC_OK 0
#define SYNC_ERR 1

static const char* code_to_name(int prim) {
  switch (prim) {
    case SQLITE_OK: return "SQLITE_OK";
    case SQLITE_ERROR: return "SQLITE_ERROR";
    case SQLITE_INTERNAL: return "SQLITE_INTERNAL";
    case SQLITE_PERM: return "SQLITE_PERM";
    case SQLITE_ABORT: return "SQLITE_ABORT";
    case SQLITE_BUSY: return "SQLITE_BUSY";
    case SQLITE_LOCKED: return "SQLITE_LOCKED";
    case SQLITE_NOMEM: return "SQLITE_NOMEM";
    case SQLITE_READONLY: return "SQLITE_READONLY";
    case SQLITE_INTERRUPT: return "SQLITE_INTERRUPT";
    case SQLITE_IOERR: return "SQLITE_IOERR";
    case SQLITE_CORRUPT: return "SQLITE_CORRUPT";
    case SQLITE_NOTFOUND: return "SQLITE_NOTFOUND";
    case SQLITE_FULL: return "SQLITE_FULL";
    case SQLITE_CANTOPEN: return "SQLITE_CANTOPEN";
    case SQLITE_PROTOCOL: return "SQLITE_PROTOCOL";
    case SQLITE_EMPTY: return "SQLITE_EMPTY";
    case SQLITE_SCHEMA: return "SQLITE_SCHEMA";
    case SQLITE_TOOBIG: return "SQLITE_TOOBIG";
    case SQLITE_CONSTRAINT: return "SQLITE_CONSTRAINT";
    case SQLITE_MISMATCH: return "SQLITE_MISMATCH";
    case SQLITE_MISUSE: return "SQLITE_MISUSE";
    case SQLITE_NOLFS: return "SQLITE_NOLFS";
    case SQLITE_AUTH: return "SQLITE_AUTH";
    case SQLITE_FORMAT: return "SQLITE_FORMAT";
    case SQLITE_RANGE: return "SQLITE_RANGE";
    case SQLITE_NOTADB: return "SQLITE_NOTADB";
    default: return "SQLITE_ERROR";
  }
}

static void throw_msg(napi_env env, const char* codeName, const char* msg) {
  napi_value code, message, err;
  napi_create_string_utf8(env, codeName, NAPI_AUTO_LENGTH, &code);
  napi_create_string_utf8(env, msg ? msg : "unknown sqlite error", NAPI_AUTO_LENGTH, &message);
  napi_create_error(env, code, message, &err);
  napi_set_named_property(env, err, "code", code);
  napi_throw(env, err);
}

static void throw_sqlite(napi_env env, sqlite3* db) {
  int ext = sqlite3_extended_errcode(db);
  const char* msg = sqlite3_errmsg(db);
  throw_msg(env, code_to_name(ext & 0xff), msg);
}

typedef struct {
  sqlite3* db;
} DbWrap;

typedef struct {
  sqlite3_stmt* stmt;
} StmtWrap;

static void DbWrap_finalizer(napi_env env, void* data, void* hint) {
  DbWrap* w = (DbWrap*)data;
  if (w) {
    if (w->db) {
      sqlite3_close_v2(w->db);
      w->db = NULL;
    }
    free(w);
  }
}

static void StmtWrap_finalizer(napi_env env, void* data, void* hint) {
  StmtWrap* w = (StmtWrap*)data;
  if (w) {
    if (w->stmt) {
      sqlite3_finalize(w->stmt);
      w->stmt = NULL;
    }
    free(w);
  }
}

static DbWrap* get_db(napi_env env, napi_callback_info info, size_t need_args) {
  size_t argc = need_args + 1;
  napi_value args[16];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc < 1) {
    napi_throw_type_error(env, NULL, "db handle required");
    return NULL;
  }
  DbWrap* w = NULL;
  if (napi_get_value_external(env, args[0], (void**)&w) != napi_ok || !w || !w->db) {
    napi_throw_type_error(env, NULL, "invalid db handle");
    return NULL;
  }
  return w;
}

static StmtWrap* get_stmt(napi_env env, napi_callback_info info, size_t* argc_out, napi_value** args_out) {
  size_t argc = 16;
  napi_value* args = (napi_value*)malloc(sizeof(napi_value) * 16);
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc < 1) {
    free(args);
    napi_throw_type_error(env, NULL, "stmt handle required");
    return NULL;
  }
  StmtWrap* w = NULL;
  if (napi_get_value_external(env, args[0], (void**)&w) != napi_ok || !w || !w->stmt) {
    free(args);
    napi_throw_type_error(env, NULL, "invalid stmt handle");
    return NULL;
  }
  *argc_out = argc;
  *args_out = args;
  return w;
}

static napi_value Open(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc < 1) {
    napi_throw_type_error(env, NULL, "path required");
    return NULL;
  }
  char path[4096];
  size_t len = 0;
  if (napi_get_value_string_utf8(env, args[0], path, sizeof(path), &len) != napi_ok) {
    napi_throw_type_error(env, NULL, "path must be a string");
    return NULL;
  }
  sqlite3* db = NULL;
  int flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX;
  int rc = sqlite3_open_v2(path, &db, flags, NULL);
  if (rc != SQLITE_OK) {
    const char* msg = db ? sqlite3_errmsg(db) : "cannot open database";
    if (db) sqlite3_close_v2(db);
    throw_msg(env, code_to_name(rc & 0xff), msg);
    return NULL;
  }
  sqlite3_busy_timeout(db, 5000);
  DbWrap* w = (DbWrap*)malloc(sizeof(DbWrap));
  w->db = db;
  napi_value ext;
  napi_create_external(env, w, DbWrap_finalizer, NULL, &ext);
  return ext;
}

static napi_value Close(napi_env env, napi_callback_info info) {
  DbWrap* w = get_db(env, info, 0);
  if (!w) return NULL;
  sqlite3_close_v2(w->db);
  w->db = NULL;
  napi_value undef;
  napi_get_undefined(env, &undef);
  return undef;
}

static napi_value Exec(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value args[3];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  DbWrap* w = get_db(env, info, 1);
  if (!w) return NULL;
  if (argc < 2) {
    napi_throw_type_error(env, NULL, "sql required");
    return NULL;
  }
  size_t len = 0;
  napi_get_value_string_utf8(env, args[1], NULL, 0, &len);
  char* sql = (char*)malloc(len + 1);
  napi_get_value_string_utf8(env, args[1], sql, len + 1, &len);
  char* err = NULL;
  int rc = sqlite3_exec(w->db, sql, NULL, NULL, &err);
  free(sql);
  if (rc != SQLITE_OK) {
    throw_msg(env, code_to_name(rc & 0xff), err ? err : sqlite3_errmsg(w->db));
    if (err) sqlite3_free(err);
    sqlite3_exec(w->db, "ROLLBACK", NULL, NULL, NULL);
    return NULL;
  }
  napi_value undef;
  napi_get_undefined(env, &undef);
  return undef;
}

static napi_value Prepare(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value args[3];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  DbWrap* w = get_db(env, info, 1);
  if (!w) return NULL;
  if (argc < 2) {
    napi_throw_type_error(env, NULL, "sql required");
    return NULL;
  }
  size_t len = 0;
  napi_get_value_string_utf8(env, args[1], NULL, 0, &len);
  char* sql = (char*)malloc(len + 1);
  napi_get_value_string_utf8(env, args[1], sql, len + 1, &len);
  sqlite3_stmt* stmt = NULL;
  int rc = sqlite3_prepare_v2(w->db, sql, (int)len + 1, &stmt, NULL);
  free(sql);
  if (rc != SQLITE_OK) {
    throw_sqlite(env, w->db);
    return NULL;
  }
  StmtWrap* sw = (StmtWrap*)malloc(sizeof(StmtWrap));
  sw->stmt = stmt;
  napi_value ext;
  napi_create_external(env, sw, StmtWrap_finalizer, NULL, &ext);
  return ext;
}

static napi_value Finalize(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  napi_value* args = NULL;
  StmtWrap* w = get_stmt(env, info, &argc, &args);
  if (!w) return NULL;
  free(args);
  sqlite3_finalize(w->stmt);
  w->stmt = NULL;
  napi_value undef;
  napi_get_undefined(env, &undef);
  return undef;
}

/* Bind positional params from args[start .. argc-1]. Returns 0 on success. */
static int bind_params(napi_env env, sqlite3_stmt* stmt, size_t argc, napi_value* args, size_t start) {
  sqlite3* db = sqlite3_db_handle(stmt);
  int idx = 1;
  for (size_t i = start; i < argc; i++, idx++) {
    napi_valuetype t;
    napi_typeof(env, args[i], &t);
    int rc = SQLITE_OK;
    if (t == napi_undefined || t == napi_null) {
      rc = sqlite3_bind_null(stmt, idx);
    } else if (t == napi_boolean) {
      bool b = false;
      napi_get_value_bool(env, args[i], &b);
      rc = sqlite3_bind_int(stmt, idx, b ? 1 : 0);
    } else if (t == napi_number) {
      double d = 0;
      napi_get_value_double(env, args[i], &d);
      if (d == (double)(sqlite3_int64)d && d >= -9.007199254740992e15 && d <= 9.007199254740992e15) {
        rc = sqlite3_bind_int64(stmt, idx, (sqlite3_int64)d);
      } else {
        rc = sqlite3_bind_double(stmt, idx, d);
      }
    } else if (t == napi_string) {
      size_t len = 0;
      napi_get_value_string_utf8(env, args[i], NULL, 0, &len);
      char* s = (char*)malloc(len + 1);
      napi_get_value_string_utf8(env, args[i], s, len + 1, &len);
      rc = sqlite3_bind_text(stmt, idx, s, (int)len, SQLITE_TRANSIENT);
      free(s);
    } else {
      /* buffer / typedarray / arraybuffer -> BLOB */
      bool is_typed = false, is_ab = false, is_buf = false;
      napi_is_typedarray(env, args[i], &is_typed);
      napi_is_arraybuffer(env, args[i], &is_ab);
      napi_is_buffer(env, args[i], &is_buf);
      void* data = NULL;
      size_t byte_len = 0;
      if (is_buf) {
        napi_get_buffer_info(env, args[i], &data, &byte_len);
      } else if (is_typed) {
        napi_typedarray_type tt;
        size_t elems = 0, off = 0;
        napi_value ab;
        napi_get_typedarray_info(env, args[i], &tt, &elems, &data, &ab, &off);
        /* byte length depends on element size */
        size_t esz = 1;
        switch (tt) {
          case napi_int16_array: case napi_uint16_array: esz = 2; break;
          case napi_int32_array: case napi_uint32_array: case napi_float32_array: esz = 4; break;
          case napi_float64_array: case napi_bigint64_array: case napi_biguint64_array: esz = 8; break;
          default: esz = 1; break;
        }
        byte_len = elems * esz;
      } else if (is_ab) {
        napi_get_arraybuffer_info(env, args[i], &data, &byte_len);
      } else {
        /* Fallback: stringify objects so JSON-ish params still bind */
        napi_value coerced;
        if (napi_coerce_to_string(env, args[i], &coerced) == napi_ok) {
          size_t len = 0;
          napi_get_value_string_utf8(env, coerced, NULL, 0, &len);
          char* s = (char*)malloc(len + 1);
          napi_get_value_string_utf8(env, coerced, s, len + 1, &len);
          rc = sqlite3_bind_text(stmt, idx, s, (int)len, SQLITE_TRANSIENT);
          free(s);
          continue;
        }
        throw_msg(env, "SQLITE_MISUSE", "unsupported bind parameter type");
        return SYNC_ERR;
      }
      rc = sqlite3_bind_blob(stmt, idx, data, (int)byte_len, SQLITE_TRANSIENT);
    }
    if (rc != SQLITE_OK) {
      throw_sqlite(env, db);
      return SYNC_ERR;
    }
  }
  return SYNC_OK;
}

static int read_row(napi_env env, sqlite3_stmt* stmt, napi_value* out) {
  int ncol = sqlite3_column_count(stmt);
  napi_value obj;
  napi_create_object(env, &obj);
  for (int i = 0; i < ncol; i++) {
    const char* name = sqlite3_column_name(stmt, i);
    napi_value val;
    switch (sqlite3_column_type(stmt, i)) {
      case SQLITE_INTEGER: {
        sqlite3_int64 v = sqlite3_column_int64(stmt, i);
        napi_create_double(env, (double)v, &val);
        break;
      }
      case SQLITE_FLOAT: {
        double v = sqlite3_column_double(stmt, i);
        napi_create_double(env, v, &val);
        break;
      }
      case SQLITE_TEXT: {
        const unsigned char* s = sqlite3_column_text(stmt, i);
        int len = sqlite3_column_bytes(stmt, i);
        napi_create_string_utf8(env, s ? (const char*)s : "", len, &val);
        break;
      }
      case SQLITE_BLOB: {
        const void* p = sqlite3_column_blob(stmt, i);
        int len = sqlite3_column_bytes(stmt, i);
        void* copy = NULL;
        napi_create_buffer_copy(env, (size_t)len, p, &copy, &val);
        break;
      }
      default:
        napi_get_null(env, &val);
        break;
    }
    napi_set_named_property(env, obj, name ? name : "?", val);
  }
  *out = obj;
  return SYNC_OK;
}

static napi_value Run(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  napi_value* args = NULL;
  StmtWrap* w = get_stmt(env, info, &argc, &args);
  if (!w) return NULL;
  sqlite3* db = sqlite3_db_handle(w->stmt);
  if (bind_params(env, w->stmt, argc, args, 1) != SYNC_OK) {
    free(args);
    return NULL;
  }
  int rc = sqlite3_step(w->stmt);
  if (rc != SQLITE_DONE && rc != SQLITE_ROW) {
    throw_sqlite(env, db);
    sqlite3_reset(w->stmt);
    sqlite3_clear_bindings(w->stmt);
    free(args);
    return NULL;
  }
  sqlite3_reset(w->stmt);
  sqlite3_clear_bindings(w->stmt);
  free(args);
  napi_value result, changes, last_id;
  napi_create_object(env, &result);
  napi_create_int64(env, sqlite3_changes(db), &changes);
  napi_create_double(env, (double)sqlite3_last_insert_rowid(db), &last_id);
  napi_set_named_property(env, result, "changes", changes);
  napi_set_named_property(env, result, "lastInsertRowid", last_id);
  return result;
}

static napi_value Get(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  napi_value* args = NULL;
  StmtWrap* w = get_stmt(env, info, &argc, &args);
  if (!w) return NULL;
  sqlite3* db = sqlite3_db_handle(w->stmt);
  if (bind_params(env, w->stmt, argc, args, 1) != SYNC_OK) {
    free(args);
    return NULL;
  }
  int rc = sqlite3_step(w->stmt);
  napi_value out = NULL;
  if (rc == SQLITE_ROW) {
    napi_value row;
    read_row(env, w->stmt, &row);
    out = row;
  } else if (rc == SQLITE_DONE) {
    napi_get_undefined(env, &out);
  } else {
    throw_sqlite(env, db);
  }
  sqlite3_reset(w->stmt);
  sqlite3_clear_bindings(w->stmt);
  free(args);
  return out;
}

static napi_value All(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  napi_value* args = NULL;
  StmtWrap* w = get_stmt(env, info, &argc, &args);
  if (!w) return NULL;
  sqlite3* db = sqlite3_db_handle(w->stmt);
  if (bind_params(env, w->stmt, argc, args, 1) != SYNC_OK) {
    free(args);
    return NULL;
  }
  napi_value arr;
  napi_create_array(env, &arr);
  uint32_t n = 0;
  int rc = SQLITE_OK;
  while ((rc = sqlite3_step(w->stmt)) == SQLITE_ROW) {
    napi_value row;
    read_row(env, w->stmt, &row);
    napi_set_element(env, arr, n, row);
    n++;
  }
  sqlite3_reset(w->stmt);
  sqlite3_clear_bindings(w->stmt);
  free(args);
  if (rc != SQLITE_DONE) {
    throw_sqlite(env, db);
    return NULL;
  }
  return arr;
}

static napi_value Version(napi_env env, napi_callback_info info) {
  napi_value out;
  napi_create_string_utf8(env, sqlite3_libversion(), NAPI_AUTO_LENGTH, &out);
  return out;
}

#define REG_MARKER_PATH "/data/storage/el2/base/files/localminidrama-desktop/addon-reg.log"

static void reg_diag(const char* name, int sc, int ss) {
  FILE* fp = fopen(REG_MARKER_PATH, "a");
  if (fp) {
    fprintf(fp, "%s create=%d set=%d\n", name, sc, ss);
    fclose(fp);
  }
}

NAPI_MODULE_INIT() {
  nd_init();
  {
    /* Device diagnostics: prove this registration callback actually ran. */
    uint32_t nv = 0;
    napi_get_version(env, &nv);
    FILE* fp = fopen(REG_MARKER_PATH, "a");
    if (fp) {
      fprintf(fp, "napi registration invoked napi_version=%u\n", nv);
      fclose(fp);
    }
  }
  napi_value fn;
  napi_status sc, ss;
  sc = napi_create_function(env, "open", NAPI_AUTO_LENGTH, Open, NULL, &fn);
  ss = napi_set_named_property(env, exports, "open", fn);
  reg_diag("open", sc, ss);
  sc = napi_create_function(env, "close", NAPI_AUTO_LENGTH, Close, NULL, &fn);
  ss = napi_set_named_property(env, exports, "close", fn);
  reg_diag("close", sc, ss);
  sc = napi_create_function(env, "exec", NAPI_AUTO_LENGTH, Exec, NULL, &fn);
  ss = napi_set_named_property(env, exports, "exec", fn);
  reg_diag("exec", sc, ss);
  sc = napi_create_function(env, "prepare", NAPI_AUTO_LENGTH, Prepare, NULL, &fn);
  ss = napi_set_named_property(env, exports, "prepare", fn);
  reg_diag("prepare", sc, ss);
  sc = napi_create_function(env, "finalize", NAPI_AUTO_LENGTH, Finalize, NULL, &fn);
  ss = napi_set_named_property(env, exports, "finalize", fn);
  reg_diag("finalize", sc, ss);
  sc = napi_create_function(env, "run", NAPI_AUTO_LENGTH, Run, NULL, &fn);
  ss = napi_set_named_property(env, exports, "run", fn);
  reg_diag("run", sc, ss);
  sc = napi_create_function(env, "get", NAPI_AUTO_LENGTH, Get, NULL, &fn);
  ss = napi_set_named_property(env, exports, "get", fn);
  reg_diag("get", sc, ss);
  sc = napi_create_function(env, "all", NAPI_AUTO_LENGTH, All, NULL, &fn);
  ss = napi_set_named_property(env, exports, "all", fn);
  reg_diag("all", sc, ss);
  sc = napi_create_function(env, "version", NAPI_AUTO_LENGTH, Version, NULL, &fn);
  ss = napi_set_named_property(env, exports, "version", fn);
  reg_diag("version", sc, ss);
  return exports;
}
