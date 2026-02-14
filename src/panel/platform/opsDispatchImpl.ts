// src/panel/platform/opsDispatchImpl.ts
import type { OpImpls } from "./opsDispatchCore";
import { logWarn, logTrace } from "../app/log";

import { removeSmallComponents } from "../tabs/pipeline/lib/morphology";

import { thresholdManual } from "../tabs/pipeline/lib/threshold";
import { resizeNative } from "../tabs/pipeline/lib/resize";
import { denoiseNative } from "../tabs/pipeline/lib/denoise";
import { colorNative } from "../tabs/pipeline/lib/color";
import { morphologyNative } from "../tabs/pipeline/lib/morphology";
import { edgeFromMask } from "../tabs/pipeline/lib/edge";
import { edgeMaskToSvg } from "../tabs/pipeline/lib/svg";

// This is used by opsDispatch.ts to prove which impl got bundled.
export const OPS_IMPL_SOURCE = "extension" as const;

export const opImpls: OpImpls = {
  "mage.clean.removeSmallComponents": {
    native: (input, params) => {
      logTrace("[op] image.clean.removeSmallComponents native", {
        width: input.width,
        height: input.height,
        cleanMinArea: params.cleanMinArea,
      });
      return removeSmallComponents(input.mask, input.width, input.height, params.cleanMinArea);
    },
    opencv: (input, params) => {
      logWarn("OpenCV image.clean.removeSmallComponents requested, falling back to native (extension build).");
      logTrace("[op] image.clean.removeSmallComponents opencv->native", {
        width: input.width,
        height: input.height,
        cleanMinArea: params.cleanMinArea,
      });
      return removeSmallComponents(input.mask, input.width, input.height, params.cleanMinArea);
    },
  },

  // -----------------------------
  // Segmentation (extension): native implementations
  // -----------------------------
  "segmentation.resize": {
    native: (input, params) => {
      logTrace("[op] segmentation.resize native", { width: input.width, height: input.height });
      return resizeNative(input.image, input.width, input.height, {
        resizeAlgo: params.resizeAlgo,
        targetMaxW: params.targetMaxW,
      });
    },
    opencv: (input, params) => {
      logWarn("OpenCV segmentation.resize requested, falling back to native (extension build).");
      logTrace("[op] segmentation.resize opencv->native", { width: input.width, height: input.height });
      return resizeNative(input.image, input.width, input.height, {
        resizeAlgo: params.resizeAlgo,
        targetMaxW: params.targetMaxW,
      });
    },
  },

  "segmentation.denoise": {
    native: (input, params) => {
      logTrace("[op] segmentation.denoise native", { width: input.width, height: input.height });
      return denoiseNative(input.image, input.width, input.height, {
        denoiseAlgo: params.denoiseAlgo,
        blurK: params.blurK,
        bilateralSigma: params.bilateralSigma,
      });
    },
    opencv: (input, params) => {
      logWarn("OpenCV segmentation.denoise requested, falling back to native (extension build).");
      logTrace("[op] segmentation.denoise opencv->native", { width: input.width, height: input.height });
      return denoiseNative(input.image, input.width, input.height, {
        denoiseAlgo: params.denoiseAlgo,
        blurK: params.blurK,
        bilateralSigma: params.bilateralSigma,
      });
    },
  },

  "segmentation.color": {
    native: (input, params) => {
      logTrace("[op] segmentation.color native", { width: input.width, height: input.height });
      return colorNative(input.image, input.width, input.height, {
        colorMode: params.colorMode,
        hsvChannel: params.hsvChannel,
      });
    },
    opencv: (input, params) => {
      logWarn("OpenCV segmentation.color requested, falling back to native (extension build).");
      logTrace("[op] segmentation.color opencv->native", { width: input.width, height: input.height });
      return colorNative(input.image, input.width, input.height, {
        colorMode: params.colorMode,
        hsvChannel: params.hsvChannel,
      });
    },
  },

  "segmentation.threshold": {
    native: (input, params) => {
      logTrace("[op] segmentation.threshold native", {
        width: input.width,
        height: input.height,
        manualT: params.manualT,
      });
      return thresholdManual(input.image, input.width, input.height, { manualT: params.manualT });
    },
    opencv: (input, params) => {
      logWarn("OpenCV segmentation.threshold requested, falling back to native (extension build).");
      logTrace("[op] segmentation.threshold opencv->native", {
        width: input.width,
        height: input.height,
        manualT: params.manualT,
      });
      return thresholdManual(input.image, input.width, input.height, { manualT: params.manualT });
    },
  },

  "segmentation.morphology": {
    native: (input, params) => {
      logTrace("[op] segmentation.morphology native", {
        width: input.width,
        height: input.height,
        morphAlgo: params.morphAlgo,
        morphK: params.morphK,
        morphIters: params.morphIters,
      });
      return morphologyNative(input.mask, input.width, input.height, {
        morphAlgo: params.morphAlgo,
        morphK: params.morphK,
        morphIters: params.morphIters,
      });
    },
    opencv: (input, params) => {
      logWarn("OpenCV segmentation.morphology requested, falling back to native (extension build).");
      logTrace("[op] segmentation.morphology opencv->native", {
        width: input.width,
        height: input.height,
        morphAlgo: params.morphAlgo,
        morphK: params.morphK,
        morphIters: params.morphIters,
      });
      return morphologyNative(input.mask, input.width, input.height, {
        morphAlgo: params.morphAlgo,
        morphK: params.morphK,
        morphIters: params.morphIters,
      });
    },
  },

  // -----------------------------
  // Edge (extension): native implementations
  // -----------------------------
  "edge.resize": {
    native: (input, params) => {
      logTrace("[op] edge.resize native", { width: input.width, height: input.height });
      return resizeNative(input.image, input.width, input.height, {
        resizeAlgo: params.resizeAlgo,
        targetMaxW: params.targetMaxW,
      });
    },
    opencv: (input, params) => {
      logWarn("OpenCV edge.resize requested, falling back to native (extension build).");
      logTrace("[op] edge.resize opencv->native", { width: input.width, height: input.height });
      return resizeNative(input.image, input.width, input.height, {
        resizeAlgo: params.resizeAlgo,
        targetMaxW: params.targetMaxW,
      });
    },
  },

  "edge.threshold": {
    native: (input, params) => {
      logTrace("[op] edge.threshold native", {
        width: input.width,
        height: input.height,
        manualT: params.manualT,
      });
      return thresholdManual(input.image, input.width, input.height, { manualT: params.manualT });
    },
    opencv: (input, params) => {
      logWarn("OpenCV edge.threshold requested, falling back to native (extension build).");
      logTrace("[op] edge.threshold opencv->native", {
        width: input.width,
        height: input.height,
        manualT: params.manualT,
      });
      return thresholdManual(input.image, input.width, input.height, { manualT: params.manualT });
    },
  },

  "edge.morphology": {
    native: (input, params) => {
      logTrace("[op] edge.morphology native", {
        width: input.width,
        height: input.height,
        morphAlgo: params.morphAlgo,
        morphK: params.morphK,
        morphIters: params.morphIters,
      });
      return morphologyNative(input.mask, input.width, input.height, {
        morphAlgo: params.morphAlgo,
        morphK: params.morphK,
        morphIters: params.morphIters,
      });
    },
    opencv: (input, params) => {
      logWarn("OpenCV edge.morphology requested, falling back to native (extension build).");
      logTrace("[op] edge.morphology opencv->native", {
        width: input.width,
        height: input.height,
        morphAlgo: params.morphAlgo,
        morphK: params.morphK,
        morphIters: params.morphIters,
      });
      return morphologyNative(input.mask, input.width, input.height, {
        morphAlgo: params.morphAlgo,
        morphK: params.morphK,
        morphIters: params.morphIters,
      });
    },
  },

  "edge.extract": {
    native: (input, _params) => {
      logTrace("[op] edge.extract native", { width: input.width, height: input.height }); 
      return edgeFromMask(input.mask, input.width, input.height); 
    },
    opencv: (input, _params) => {
      logWarn("OpenCV edge.extract requested, falling back to native (extension build).");
      logTrace("[op] edge.extract opencv->native", { width: input.width, height: input.height });
      return edgeFromMask(input.mask, input.width, input.height); 
    },
  },

 
  "svg.create": {
    native: (input, params) => {
      logTrace("[op] svg.create native", { width: input.width, height: input.height, scale: params.scale });
      return edgeMaskToSvg(input.mask, input.width, input.height, {
        scale: params.scale,
        transparentBg: !!params.transparentBg,
        color: params.color,
      });
    },
    opencv: (input, params) => {
      logWarn("OpenCV svg.create requested, falling back to native (extension build).");
      logTrace("[op] svg.create opencv->native", { width: input.width, height: input.height, scale: params.scale });
      return edgeMaskToSvg(input.mask, input.width, input.height, {
        scale: params.scale,
        transparentBg: !!params.transparentBg,
        color: params.color,
      });
    },
  },

};
