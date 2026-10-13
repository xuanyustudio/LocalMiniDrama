// Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { injectable, inject } from 'inversify';
import common from '@ohos.app.ability.common';
import fileUri from '@ohos.file.fileuri';
import { OpenLinkOptions, Want, wantConstant } from '@kit.AbilityKit';
import { uniformTypeDescriptor } from '@kit.ArkData';

import { BaseAdapter } from '../common/BaseAdapter';
import { ContextAdapter } from './ContextAdapter';
import LaunchHelper from '../utils/LaunchHelper';
import LogUtil from '../utils/LogUtil';
import LogMethod from '../common/LogDecorator';

const TAG: string = 'FileManagerAdapter';

@injectable()
export class FileManagerAdapter extends BaseAdapter {
  private ctxAdapter: ContextAdapter;

  constructor(@inject(ContextAdapter) ctxAdapter: ContextAdapter) {
    super();
    this.ctxAdapter = ctxAdapter;
  }

  @LogMethod
  openItemInFolder(filePath: string) {
    let uri = fileUri.getUriFromPath(filePath);
    let link = 'filemanager://openDirectory';
    let openLinkOptions: OpenLinkOptions = {
      appLinkingOnly: false,
      parameters: {
        'fileUri': uri
      }
    };
    try {
      (this.ctxAdapter.getActiveContext() as common.UIAbilityContext).openLink(link, openLinkOptions);
    } catch (error) {
      LogUtil.error(TAG, `openItemInFolder openLink try to open uri ${uri} fail, err = ${JSON.stringify(error)}`);
    }
  }

  @LogMethod
  openVerifiedItem(filePath: string) {
    let uri = fileUri.getUriFromPath(filePath);
    const want: Want = {
      // Configure read and write permissions for shared files,
      // such as granting read and write authorization to shared applications
      flags: wantConstant.Flags.FLAG_AUTH_WRITE_URI_PERMISSION |
             wantConstant.Flags.FLAG_AUTH_READ_URI_PERMISSION,
      action: "ohos.want.action.viewData",
      uri: uri
    }
    LaunchHelper.Launch(this.ctxAdapter.getActiveContext(), want);
  }

  @LogMethod
  openUrlInDefaultBrowser(url: string) {
    let want: Want = {
      action: 'ohos.want.action.viewData',
      entities: ['entity.system.browsable'],
      uri: url
    };
    LaunchHelper.Launch(this.ctxAdapter.getActiveContext(), want);
  }

  @LogMethod
  getFileTypeIdByFileExtension(filenameExtension: string): string {
    try {
      let typeId: string = uniformTypeDescriptor.getUniformDataTypeByFilenameExtension(filenameExtension);
      if (!typeId) {
        LogUtil.error(TAG, "getUniformDataTypeByFilenameExtension failed! FilenameExtension is: " + filenameExtension);
        return '';
      }
      return typeId;
    } catch (error) {
      LogUtil.error(TAG,
        `getUniformDataTypeByFilenameExtension throws an exception.FilenameExtension is: ${filenameExtension}: error is: ` +
        JSON.stringify(error));
      return '';
    }
  }

  @LogMethod
  getFileIconByFileTypeId(fileTypeId: string, callback: (icon: ArrayBuffer) => void): void {
    // FileManagerServiceKit is not available in the current SDK build; degrade gracefully.
    LogUtil.warn(TAG, `getFileIconByFileTypeId is unsupported in this build, fileTypeId: ${fileTypeId}`);
    callback(new ArrayBuffer(0));
  }

  @LogMethod
  deleteFileToTrash(filePath: string, callback: (result: boolean) => void) {
    // FileManagerServiceKit is not available in the current SDK build; degrade gracefully.
    LogUtil.warn(TAG, `deleteFileToTrash is unsupported in this build, filePath: ${filePath}`);
    callback(false);
  }
}
