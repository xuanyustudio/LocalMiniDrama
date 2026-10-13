// Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { injectable } from 'inversify';
import { BaseAdapter } from '../common/BaseAdapter';
import LogUtil from '../utils/LogUtil';
import LogMethod from '../common/LogDecorator';

const tag: string = 'ShapeDetection';

@injectable()
export class ShapeDetectionAdapter extends BaseAdapter {
  @LogMethod
  TextDetect(buffer: ArrayBuffer, width: number, height: number, callback: Function): void {
    // CoreVisionKit is not available in the current SDK build; degrade gracefully.
    LogUtil.warn(tag, 'TextDetect is unsupported in this build');
    callback([], 0);
  }

  @LogMethod
  FaceDetect(buffer: ArrayBuffer, width: number, height: number, callback: Function): void {
    // CoreVisionKit is not available in the current SDK build; degrade gracefully.
    LogUtil.warn(tag, 'FaceDetect is unsupported in this build');
    callback([], 0);
  }
}
