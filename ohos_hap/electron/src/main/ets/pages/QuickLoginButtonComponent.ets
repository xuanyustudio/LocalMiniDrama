// Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ILoginInfo } from 'web_engine';

// AccountKit is not available in the current SDK build; the Huawei ID quick
// login button degrades to a placeholder. The host never routes to this page
// unless the embedded web content requests Huawei ID quick login.
@Component
export struct QuickLoginButtonComponent {
  loginCallback: (loginInfo: ILoginInfo) => void = (loginInfo: ILoginInfo) => {};

  build() {
    Column() {
      Text('Huawei ID quick login is unavailable in this build.')
        .fontSize(16)
        .fontColor(Color.Gray)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(0xffffff)
    .justifyContent(FlexAlign.Center)
  }
}
