'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import invariant from 'assert';
import {
  CompositeDisposable,
  Emitter,
  TextEditor,
} from 'atom';
import passesGK from '../../commons-node/passesGK';

import {
  NuxStore,
  NUX_SAMPLE_OUTLINE_VIEW_TOUR,
} from './NuxStore';
import {NuxTour} from './NuxTour';
import {NuxView} from './NuxView';

import type {NuxTourModel} from './NuxModel';

const GK_NUX_OUTLINE_VIEW = 'nuclide_outline_view_nux';

export class NuxManager {
  _nuxStore: NuxStore;
  _disposables: CompositeDisposable;
  _emitter: atom$Emitter;
  _isTourActive: boolean;
  // Registered NUXes that are waiting to be triggered
  _pendingNuxList: Array<NuxTour>;
  // Triggered NUXes that are waiting to be displayed
  _readyToDisplayNuxList: Array<NuxTour>;

  constructor(
    nuxStore: NuxStore,
  ): void {
    this._nuxStore = nuxStore;

    this._emitter = new Emitter();
    this._disposables = new CompositeDisposable();

    this._pendingNuxList = [];
    this._readyToDisplayNuxList = [];
    this._isTourActive = false;

    this._emitter.on('newTour', this._handleNewTour.bind(this));
    this._emitter.on('nuxTourReady', this._handleReadyTour.bind(this));

    this._disposables.add(this._nuxStore.onNewNux(this._handleNewNux.bind(this)));
    this._disposables.add(
      atom.workspace.onDidStopChangingActivePaneItem(
        this._handleActivePaneItemChanged.bind(this)
      ),
    );

    this._nuxStore.initialize();
  }

  // Handles new NUXes emitted from the store
  _handleNewNux(nuxTourModel: NuxTourModel): void {
    if (nuxTourModel.completed) {
      return;
    }

    const nuxViews = nuxTourModel.nuxList.map(model =>
      new NuxView(
        model.selector,
        model.selectorFunction,
        model.position,
        model.content,
        model.isCustomContent,
        model.displayPredicate,
        model.completionPredicate,
      )
    );

    const nuxTour = new NuxTour(
      nuxTourModel.id,
      nuxViews,
      nuxTourModel.trigger,
    );

    this._emitter.emit(
      'newTour',
      {
        nuxTour,
        nuxTourModel,
      },
    );
  }

  _handleNuxCompleted(nuxTourModel: NuxTourModel): void {
    this._isTourActive = false;
    this._nuxStore.onNuxCompleted(nuxTourModel);
    if (this._readyToDisplayNuxList.length === 0) {
      return;
    }
    const nextNux = this._readyToDisplayNuxList.shift();
    this._emitter.emit('nuxTourReady', nextNux);
  }

  // Handles NUX registry
  _handleNewTour(value: any) {
    const {
      nuxTour,
      nuxTourModel,
    } = value;
    if (nuxTourModel.id === NUX_SAMPLE_OUTLINE_VIEW_TOUR && passesGK(GK_NUX_OUTLINE_VIEW)) {
      nuxTour.setNuxCompleteCallback(
          this._handleNuxCompleted.bind(this, nuxTourModel)
      );
      if (nuxTourModel.trigger != null) {
        this._pendingNuxList.push(nuxTour);
      } else {
        this._emitter.emit('nuxTourReady', nuxTour);
      }
    }
  }

  // Handles triggered NUXes that are ready to be displayed
  _handleReadyTour(nuxTour: NuxTour) {
    if (!this._isTourActive) {
      this._isTourActive = true;
      nuxTour.begin();
    } else {
      this._readyToDisplayNuxList.push(nuxTour);
    }
  }

  _handleActivePaneItemChanged(paneItem: ?mixed): void {
    // The `paneItem` is not guaranteed to be an instance of `TextEditor` from
    // Atom's API, but usually is.  We return if the type is not `TextEditor`
    // since the `NuxTour.isReady` expects a `TextEditor` as its argument.
    if (paneItem == null || !(paneItem instanceof TextEditor)) {
      return;
    }
    invariant(paneItem instanceof TextEditor);
    for (let i = 0; i < this._pendingNuxList.length; i++) {
      const nuxToCheck = this._pendingNuxList[i];
      if (nuxToCheck.getTriggerType() !== 'editor' ||
          !nuxToCheck.isReady(paneItem)) {
        continue;
      }
      this._pendingNuxList.splice(i--, 1);
      this._emitter.emit('nuxTourReady', nuxToCheck);
    }
  }

  dispose() : void {
    this._disposables.dispose();
  }
}
