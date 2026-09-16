import { ImageResponse } from "next/og";

/* The home-screen icon: the Kalas "K" in ivory on forest green, drawn at the
   size asked for. Generated rather than shipped as files, so the two sizes
   the manifest names cannot drift apart. The mark sits well inside the
   square, so it survives being cut to a circle as a maskable icon. */
const SIZES = new Set([180, 192, 512]);

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = Number(raw);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#24413a",
          color: "#fffdf7",
          fontSize: size * 0.5,
          fontWeight: 700,
          fontFamily: "serif",
          letterSpacing: 0,
        }}
      >
        K
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
