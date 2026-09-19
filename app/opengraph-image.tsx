import { ImageResponse } from "next/og"

export const runtime = "edge"

export default function Image() {
  return new ImageResponse(<div style={{ background: "hsl(98 29% 14%)", color: "hsl(78 67% 93%)", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px" }}><div style={{ fontSize: 28, color: "hsl(78 67% 73%)", letterSpacing: 5 }}>GYMSAAS</div><div style={{ fontSize: 76, fontWeight: 700, marginTop: 24 }}>Run the gym.<br />Not the paperwork.</div><div style={{ fontSize: 30, marginTop: 30, color: "hsl(83 35% 84%)" }}>A clear workspace for gym owners.</div></div>, { width: 1200, height: 630 })
}
