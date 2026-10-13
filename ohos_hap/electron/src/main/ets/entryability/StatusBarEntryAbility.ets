// Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { UIExtensionAbility, UIExtensionContentSession, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

let TAG = 'StatusBarEntryAbility';
export default class StatusBarEntryAbility extends UIExtensionAbility {
  onCreate() {
    hilog.info(0x0000, TAG, '%{public}s', 'Ability onCreate');
  }

  onSessionCreate(want: Want, session: UIExtensionContentSession) {
    hilog.info(0x0000, TAG, '%{public}s', 'Ability onSessionCreate');
    session.loadContent('pages/StatusBarPage');
  }

  onForeground() {
    hilog.info(0x0000, TAG, '%{public}s', 'Ability onForeground');
  }

  onBackground() {
    hilog.info(0x0000, TAG, '%{public}s', 'Ability onBackground');
  }

  onSessionDestroy(session: UIExtensionContentSession) {
    hilog.info(0x0000, TAG, '%{public}s', 'Ability onSessionDestroy');
  }

  onDestroy() {
    hilog.info(0x0000, TAG, '%{public}s', 'Ability onDestroy');
  }
}
