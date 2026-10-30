// Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import adapter from 'libadapter.so';
import window from '@ohos.window';
import Inject from '../common/InjectModule';
import { ContextPathAdapter } from '../adapter/ContextPathAdapter';
import { ContextType } from '../common/Constants';
import { CaptionButtonRect, ChangeEventType, CommandParameter, CommandResult, NativeContext, WindowBound, WinLimits } from '../interface/CommonInterface';

const EMPTY_COMMAND_RESULT: CommandResult = { ret_code: -1, widget_Id: 0, last_widget_Id: 0 };

function nativeModuleReady(): boolean {
  return adapter !== undefined && adapter.getNativeContext !== undefined;
}

function unavailableNativeContext(): NativeContext {
  const context = {} as NativeContext;
  context.JSBind = {
    bindFunction: (_name: string, _func: Function): number => 0
  };
  context.ExecuteCommand = (_id: number, _param: CommandParameter): CommandResult => EMPTY_COMMAND_RESULT;
  context.GetLastActiveWidgetId = (): number => 0;
  context.BrowserDestroyed = (): boolean => false;
  context.IsSupportNodeHandleFeature = (): boolean => false;
  context.runBrowser = (_args: string[]): void => {};
  context.OnWindowStatusChange = (_id: string, _status: window.WindowStatusType): void => {};
  context.OnWindowVisibleChange = (_windowId: String, _visible: boolean): void => {};
  context.OnWindowRectChange = (_id: string, _event: WindowBound, _reason: number): void => {};
  context.OnWindowSizeChange = (_id: string, _event: WindowBound): void => {};
  context.OnWindowEvent = (_id: string, _event: number): void => {};
  context.OnWindowVisibilityChange = (_id: string, _visible: boolean): void => {};
  context.OnKeyboardHeightChange = (_id: string, _height: number): void => {};
  context.OnWindowDisplayIdChange = (_id: string, _displayId: number): void => {};
  context.OnDeviceModeChange = (_id: string, _event: ChangeEventType, _status: window.WindowStatusType): void => {};
  context.OnCaptionButtonRectChange = (_id: string, _event: CaptionButtonRect): void => {};
  context.RegisterWindowEventFilter = (_originWindowId: number): void => {};
  context.ClearWindowEventFilter = (_originWindowId: number): void => {};
  context.SetSystemWindowLimits = (_windowLimits: WinLimits): void => {};
  return context;
}

export default class JsBindingUtils {
  private static currentContext: NativeContext;

  private static currentType: ContextType;

  static initNativeContext(contextType: ContextType) {
    if (!nativeModuleReady()) {
      console.error('libadapter.so is not in the HAP. Skip native context init.');
      JsBindingUtils.currentType = contextType;
      JsBindingUtils.currentContext = unavailableNativeContext();
      return;
    }
    JsBindingUtils.currentType = contextType;
    JsBindingUtils.currentContext = adapter.getNativeContext(contextType);
  }

  static bindFunction(name: string, func: Function) {
    if (JsBindingUtils.currentContext === undefined) {
      JsBindingUtils.initNativeContext(ContextType.kMainProcess);
    }
    JsBindingUtils.currentContext.JSBind.bindFunction(name, func);
  }

  static callFunction(name: string, ...args: object[]) {
  }

  static getNativeContext(contextType: number): NativeContext {
    if (JsBindingUtils.currentType === contextType && JsBindingUtils.currentContext !== undefined) {
      return JsBindingUtils.currentContext;
    }
    if (!nativeModuleReady()) {
      return unavailableNativeContext();
    }
    return adapter.getNativeContext(contextType);
  }

  static SetContextPaths() {
    const contextPathAdapter = Inject.get(ContextPathAdapter);
    if (!contextPathAdapter) {
      console.error('ContextPathAdapter not available');
      return;
    }
    const safeGet = (fn: () => string, defaultValue: string = ''): string => {
      try { return fn(); } catch (e) { return defaultValue; }
    };
    const paths: Record<string, string> = {
      "cacheDir": safeGet((): string => contextPathAdapter.getCacheDir()),
      "filesDir": safeGet((): string => contextPathAdapter.getFilesDir()),
      "tempDir": safeGet((): string => contextPathAdapter.getTempDir()),
      "userDocumentDir": safeGet((): string => contextPathAdapter.getUserDocumentDir()),
      "userDesktopDir": safeGet((): string => contextPathAdapter.getUserDesktopDir()),
      "userDownloadDir": safeGet((): string => contextPathAdapter.getUserDownloadDir()),
    };
    if (adapter !== undefined && adapter.SetContextPaths) {
      adapter.SetContextPaths(paths);
    } else {
      console.error('SetContextPaths not found in C++ module');
    }
  }
}