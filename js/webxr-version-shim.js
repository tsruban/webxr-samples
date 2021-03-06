// Copyright 2018 The Immersive Web Community Group
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// This file contains various patches to adjust for differences in outdated browser
// implementations of the WebXR API and allow the samples to be coded exclusively
// against the most recent version.

class WebXRVersionShim {
  constructor() {
    if (this._shouldApplyPatch()) {
      this._applyPatch();
    }
  }

  _isMobile() {
    return /Android/i.test(navigator.userAgent) ||
          /iPhone|iPad|iPod/i.test(navigator.userAgent);s
  }

  _shouldApplyPatch() {
    // Don't apply the patch with WebXR isn't available.
    if (!('xr' in navigator)) {
      return false;
    }

    // Allow for universally disabling the version shim with a URL arg, which will
    // make it easier to test updates to native implementations.
    let query = window.location.search.substring(1) || window.location.hash.substring(1);
    let vars = query.split('&');
    for (let i = 0; i < vars.length; i++) {
      let pair = vars[i].split('=');
      if (pair[0].toLowerCase() == 'nowebxrversionshim') {
        return false;
      }
    }

    return true;
  }

  _applyPatch() {
    //===========================
    // Chrome 67/68
    //===========================

    // Map 'immersive' to the old 'exclusive' verbiage if needed.
    if ('exclusive' in XRSession.prototype) {
      const NATIVE_SUPPORTS_SESSION = XRDevice.prototype.supportsSession;
      XRDevice.prototype.supportsSession = function(options) {
        options.exclusive = !!options.immersive;
        return NATIVE_SUPPORTS_SESSION.call(this, options);
      };

      const NATIVE_REQUEST_SESSION = XRDevice.prototype.requestSession;
      XRDevice.prototype.requestSession = function(options) {
        options.exclusive = !!options.immersive;
        return NATIVE_REQUEST_SESSION.call(this, options);
      };

      Object.defineProperty(XRSession.prototype, 'immersive', {
        enumerable: true, configurable: false, writeable: false,
        get: function() { return this.exclusive; }
      });
    }

    // We can't test for the existence of the enums in question directly, so this code
    // will just try to create the requested type and fall back if it fails.
    const NATIVE_REQUEST_FRAME_OF_REFERENCE = XRSession.prototype.requestFrameOfReference;
    XRSession.prototype.requestFrameOfReference = function(type, options) {
      let session = this;
      // Try the current type.
      return NATIVE_REQUEST_FRAME_OF_REFERENCE.call(session, type, options).catch((error)=>{
        // FIXME: Should be checking for TypeError specifically. Requires a polyfill update.
        if(error instanceof Error) {
          // If the current type fails, switch to the other version.
          switch(type) {
            case 'eye-level':
              type = 'eyeLevel';
              break;
            case 'head-model':
              type = 'headModel';
              break;
            default:
              return Promise.reject(error);
          }
          return Promise.resolve(NATIVE_REQUEST_FRAME_OF_REFERENCE.call(session, type, options));
        } else {
          return Promise.reject(error);
        }
      });
    };

    if (!('getNativeFramebufferScaleFactor' in XRWebGLLayer)) {
      if (this._isMobile()) {
        const NATIVE_WEBGL_LAYER = XRWebGLLayer;
        const NATIVE_WEBGL_LAYER_PROTOTYPE = XRWebGLLayer.prototype;
        XRWebGLLayer = function(session, gl, options) {
          if (options && options.framebufferScaleFactor) {
            // On Chrome 67/68 mobile the default framebuffer returned is 0.7 of full res.
            options.framebufferScaleFactor = 0.7 * options.framebufferScaleFactor;
          }

          return new NATIVE_WEBGL_LAYER(session, gl, options);
        };

        XRWebGLLayer.prototype = NATIVE_WEBGL_LAYER_PROTOTYPE;
      }

      // TODO: Figure out how to monkey-patch in a static function. The code below doesn't work.
      /*XRWebGLLayer.getNativeFramebufferScaleFactor = function(session) {
        if (!session) {
          throw new TypeError('No XRSession specified');
        }
        if (isMobile()) {
          // On Chrome 67/68 mobile the default framebuffer returned is 0.7 of full res.
          return 1.42857;
        } else {
          // On Chrome 67/68 desktop the full res buffer is already returned.
          return 1.0;
        } 
      };*/
    }
  }
}
