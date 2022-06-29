export type ImageCropStrategy =
  | {
      type: "fixedCenter";
    }
  | {
      type: "fixedTop";
    }
  | {
      type: "fixedTopLeft";
    }
  | {
      type: "fixedTopRight";
    }
  | {
      type: "fixedBottom";
    }
  | {
      type: "fixedBottomLeft";
    }
  | {
      type: "fixedBottomRight";
    }
  | {
      type: "fixedLeft";
    }
  | {
      type: "fixedRight";
    }
  | {
      type: "smartEntropy";
    }
  | {
      type: "smartAttention";
    };
