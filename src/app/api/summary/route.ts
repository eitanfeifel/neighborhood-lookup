export async function POST(req: Request) {
  const { address, scores, topByCategory } = await req.json();

  const hasAnyPlaces = topByCategory.length > 0;

  const placesText = hasAnyPlaces
    ? topByCategory.map((cat: any) =>
        `${cat.category}:\n` +
        cat.places.map((p: any) =>
          `  - ${p.name}${p.rating ? ` (${p.rating.toFixed(1)}★)` : ""}${p.isWalking ? " [walkable]" : " [by car]"}`
        ).join("\n")
      ).join("\n")
    : "No nearby amenities found.";

  const prompt = `You are a neighborhood analyst writing for someone considering moving to this address.

Address: ${address}
Walk Score: ${scores.walkScore} (${scores.walkLabel})
Drive Score: ${scores.driveScore} (${scores.driveLabel})
Area Type: ${scores.urbanLabel}

Top rated nearby places by category:
${placesText}

Write the following — be concise and only mention places from the data above:

1. One short paragraph describing the neighborhood character.
2. A "Highlights" section with exactly ${hasAnyPlaces ? "3-5" : "1-2"} bullet points.
   - Each bullet names a specific place from the data and why it stands out.
   - If no walkable places exist, note the area is best explored by car.
   - Do not invent place names not in the data above.

Output should follow this format:
[neighborhood paragraph]
Be sure to check out [place name1] [one sentence reason]
and you cant miss [place name2] [one sentence reason]


Ensure the resonpse is formatted properly and add no unneccesary charecters or symbols like * --
Do not directly reference the scores of walkability and driveability, simply use them to inform your phrasing.
`
;



  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ summary: null, error: "Missing GEMINI_API_KEY" }, { status: 500 });

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.75 },
      }),
      // give it a bit more while debugging; reduce later
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error("[summary] fetch error:", err);
    return Response.json({ summary: null, error: "fetch failed" }, { status: 500 });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[summary] Gemini ${res.status}:`, body);
    return Response.json({ summary: null }, { status: 500 });
  }

  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return Response.json({ summary: text || null });
}
