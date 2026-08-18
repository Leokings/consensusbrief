import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "64px",
          height: "64px",
          overflow: "hidden",
          background: "linear-gradient(145deg, #716bf2, #4d46cc)",
          borderRadius: "18px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "-3px",
            width: "40px",
            height: "40px",
            border: "3px solid rgba(255,255,255,0.72)",
            borderRadius: "999px",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "27px",
            width: "40px",
            height: "40px",
            border: "3px solid rgba(255,255,255,0.72)",
            borderRadius: "999px",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "26px",
            left: "26px",
            width: "12px",
            height: "12px",
            background: "#ffffff",
            borderRadius: "999px",
          }}
        />
      </div>
    ),
    size,
  );
}
