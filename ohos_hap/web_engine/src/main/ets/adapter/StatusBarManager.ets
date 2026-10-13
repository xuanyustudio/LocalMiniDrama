// Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { injectable, inject } from 'inversify';

import { BaseAdapter } from '../common/BaseAdapter';
import LogUtil from '../utils/LogUtil';
import LogMethod from '../common/LogDecorator';
import { ContextAdapter } from './ContextAdapter';

const TAG: string = 'statusBar';

@injectable()
export class StatusBarManagerAdapter extends BaseAdapter {
  private TOOLTIPS: string = '';
  private TITLE: string = '';
  private isCreated: boolean = false;
  private ctxAdapter: ContextAdapter;

  constructor(
    @inject(ContextAdapter) ctxAdapter: ContextAdapter
  ) {
    super();
    this.ctxAdapter = ctxAdapter;
  }

  @LogMethod
  async SetImage(
    whiteWidth: number,
    whiteHeight: number,
    whiteIconBuffer: ArrayBuffer,
    onCompleted: (ret: boolean) => void,
    callback: () => void,
    blackWidth?: number,
    blackHeight?: number,
    blackIconBuffer?: ArrayBuffer
  ) {
    // StatusBarExtensionKit is not available in the current SDK build; degrade gracefully.
    LogUtil.warn(TAG, 'SetImage is unsupported in this build');
    this.isCreated = false;
    onCompleted && onCompleted(false);
  }

  @LogMethod
  SetToolTips(tooltips: string) {
    this.TOOLTIPS = tooltips;
  }

  @LogMethod
  SetContextMenu(menu_model: string, onCompleted: (ret: boolean) => void, callback: (id: Number) => void) {
    LogUtil.debug(TAG, `JS SetContextMenu:: ${menu_model}`);
    LogUtil.warn(TAG, 'SetContextMenu is unsupported in this build');
    onCompleted && onCompleted(false);
  }

  @LogMethod
  async RemoveFromStatusBar(onCompleted: (ret: boolean) => void) {
    LogUtil.warn(TAG, 'RemoveFromStatusBar is unsupported in this build');
    this.isCreated = false;
    onCompleted && onCompleted(false);
  }
}
