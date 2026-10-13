// Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { injectable } from 'inversify';

import { BaseAdapter } from '../common/BaseAdapter';
import LogUtil from '../utils/LogUtil';
import LogMethod from '../common/LogDecorator';

import { SpeakingParams, EngineCreationParams, VoiceQuery, VoiceInfo } from '../interface/CommonInterface';

// When the engine creation method is invoked, if no parameter is transferred,
// the default configuration is used to initialize the engine.
// refer https://developer.huawei.com/consumer/cn/doc/harmonyos-references/hms-ai-texttospeech#section235272615215
const defaultCreateEngineParams: EngineCreationParams = {
  language: 'zh-CN',
  person: 13,
  online: 1,
  extraParams: {
    "style": 'interaction-broadcast',
    "locate": 'CN',
    "name": 'defaultEngine'
  }
}

// refer https://developer.huawei.com/consumer/cn/doc/harmonyos-references/hms-ai-texttospeech#section1638144844811
const defaultVoiceQueryParams: VoiceQuery = {
  requestId: 'VOICEQUERY',
  online: 1
}

interface listVoiceMsg {
  voiceList: Array<VoiceInfo>,
  length: number;
}

const TAG = "SpeechAdapter";

@injectable()
export class SpeechAdapter extends BaseAdapter {
  private isCreated: boolean = false;
  private voiceList: Array<VoiceInfo> = [];

  @LogMethod
  createTextToSpeechEngineAndSetListener(
    callback: Function,
    startEventCallback: Function,
    endEventCallback: Function,
    params: EngineCreationParams = defaultCreateEngineParams): void {
    // CoreSpeechKit is not available in the current SDK build; degrade gracefully.
    LogUtil.warn(TAG, 'TextToSpeech engine is unsupported in this build');
    this.isCreated = false;
    callback(false);
  }

  @LogMethod
  textToSpeechEngineListVoices(callback: Function): void {
    LogUtil.warn(TAG, 'textToSpeechEngineListVoices is unsupported in this build');
    const msg: listVoiceMsg = {
      voiceList: [],
      length: 0
    };
    callback(msg);
  }

  @LogMethod
  setSpeakListener(startEventCallback: Function, endEventCallback: Function): void {
    LogUtil.warn(TAG, 'setSpeakListener is unsupported in this build');
  }

  @LogMethod
  isTextToSpeechEngineCreated(): boolean {
    return this.isCreated;
  }

  @LogMethod
  speak(text: string, params: SpeakingParams): boolean {
    LogUtil.warn(TAG, 'speak is unsupported in this build');
    return false;
  }

  @LogMethod
  isSpeaking(): boolean {
    return false;
  }

  @LogMethod
  stopSpeaking(): boolean {
    return false;
  }

  @LogMethod
  isInitialized(): boolean {
    return false;
  }

  @LogMethod
  textToSpeechEngineShutdown(): boolean {
    return true;
  }
}
