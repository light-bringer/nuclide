'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {BusySignalProvider} from '../../busy-signal-interfaces';

import type {StatusBarTile as StatusBarTileType} from './StatusBarTile';

import {Disposable, CompositeDisposable} from 'atom';
import invariant from 'assert';
import {MessageStore} from './MessageStore';

class Activation {
  _statusBarTile: ?StatusBarTileType;
  _disposables: CompositeDisposable;
  _messageStore: MessageStore;

  constructor() {
    this._disposables = new CompositeDisposable();
    this._messageStore = new MessageStore();
  }

  dispose() {
    this._disposables.dispose();
  }

  consumeStatusBar(statusBar: atom$StatusBar): atom$IDisposable {
    const {StatusBarTile} = require('./StatusBarTile');
    const statusBarTile = this._statusBarTile = new StatusBarTile();
    statusBarTile.consumeMessageStream(this._messageStore.getMessageStream());
    const disposable = new Disposable(() => {
      if (this._statusBarTile) {
        this._statusBarTile.dispose();
        this._statusBarTile = null;
      }
    });
    statusBarTile.consumeStatusBar(statusBar);
    this._disposables.add(disposable);
    return disposable;
  }

  consumeBusySignalProvider(provider: BusySignalProvider): atom$IDisposable {
    const disposable = this._messageStore.consumeProvider(provider);
    this._disposables.add(disposable);
    return disposable;
  }
}

let activation: ?Activation = null;

export function activate(state: ?Object): void {
  deactivate();
  activation = new Activation();
}

export function consumeStatusBar(statusBar: atom$StatusBar): atom$IDisposable {
  invariant(activation);
  return activation.consumeStatusBar(statusBar);
}

export function consumeBusySignalProvider(provider: BusySignalProvider): atom$IDisposable {
  invariant(activation);
  return activation.consumeBusySignalProvider(provider);
}

export function deactivate(): void {
  if (activation) {
    activation.dispose();
    activation = null;
  }
}
