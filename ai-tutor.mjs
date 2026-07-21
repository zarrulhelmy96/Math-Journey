const MAX_BODY_BYTES = 6 * 1024 * 1024;
const FIREBASE_API_KEY = "AIzaSyCsFCvkBLuLHzUVGokE82jRWshbsTsavVI";
const FIREBASE_DATABASE_URL = "https://math-journey-2fd87-default-rtdb.asia-southeast1.firebasedatabase.app";

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function verifyFirebaseUser(idToken) {
  const verifyResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  const verifyData = await verifyResponse.json().catch(() => ({}));
  const user = verifyData?.users?.[0];
  if (!verifyResponse.ok || !user?.localId) {
    throw Object.assign(new Error("Token login tidak sah atau telah tamat."), { status: 401 });
  }
  return { uid: user.localId, email: user.email || "" };
}

async function readFirebase(path, idToken) {
  const url = `${FIREBASE_DATABASE_URL}/${path}.json?auth=${encodeURIComponent(idToken)}`;
  const response = await fetch(url, { headers: { "Cache-Control": "no-store" } });
  if (!response.ok) {
    throw Object.assign(new Error("Firebase tidak membenarkan semakan akses pengguna."), { status: 403 });
  }
  return await response.json();
}

async function requirePremium(request) {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw Object.assign(new Error("Sila log masuk untuk menggunakan AI Tutor."), { status: 401 });
  }

  const idToken = match[1].trim();
  const verified = await verifyFirebaseUser(idToken);
  const [profile, adminFlag] = await Promise.all([
    readFirebase(`users/${verified.uid}`, idToken),
    readFirebase(`admins/${verified.uid}`, idToken).catch(() => false)
  ]);

  const isAdmin = adminFlag === true || profile?.isAdmin === true || profile?.admin === true || profile?.role === "admin";
  const isPremium = profile?.premium === true || profile?.hasAccess === true;

  if (!isPremium && !isAdmin) {
    throw Object.assign(new Error("AI Tutor hanya tersedia untuk pengguna premium."), { status: 403 });
  }
  return { ...verified, isAdmin, isPremium };
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Kaedah tidak dibenarkan." }, 405);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: "Fail terlalu besar." }, 413);

  const apiKey = Netlify.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY belum ditetapkan di Netlify." }, 500);

  try {
    await requirePremium(request);

    const body = await request.json();
    const question = String(body.question || "").trim().slice(0, 2000);
    const form = String(body.form || "Tingkatan 3").slice(0, 40);
    const chapter = String(body.chapter || "").trim().slice(0, 100);
    const mode = ["hint", "steps", "check"].includes(body.mode) ? body.mode : "hint";
    const imageDataUrl = String(body.imageDataUrl || "");

    if (!question && !imageDataUrl) return json({ error: "Soalan atau gambar diperlukan." }, 400);
    if (imageDataUrl && !/^data:image\/(jpeg|png|webp);base64,/i.test(imageDataUrl)) {
      return json({ error: "Format gambar tidak disokong." }, 400);
    }

    const modeInstruction = {
      hint: "Mulakan dengan satu petunjuk. Kemudian terangkan penyelesaian secara berperingkat tanpa melompat langkah.",
      steps: "Berikan penyelesaian langkah demi langkah yang lengkap dan mudah diikuti.",
      check: "Semak kerja atau jawapan pelajar. Nyatakan bahagian betul, kesilapan, dan pembetulan langkah demi langkah."
    }[mode];

    const content = [{
      type: "input_text",
      text: `Konteks pelajar: ${form}${chapter ? `, ${chapter}` : ""}.\nArahan: ${modeInstruction}\nSoalan pelajar: ${question || "Sila baca soalan dalam gambar."}`
    }];
    if (imageDataUrl) content.push({ type: "input_image", image_url: imageDataUrl });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Netlify.env.get("OPENAI_MODEL") || "gpt-5-mini",
        store: false,
        max_output_tokens: 1400,
        instructions: "Anda ialah AI Tutor Math Journey untuk pelajar sekolah menengah Malaysia. Jawab dalam Bahasa Melayu yang mudah, tepat dan mesra. Fokus pada matematik. Gunakan notasi yang jelas. Jangan mereka-reka fakta. Jika gambar kabur atau maklumat tidak cukup, minta pelajar beri gambar lebih jelas atau maklumat tambahan.",
        input: [{ role: "user", content }]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("OpenAI error", data);
      return json({ error: data?.error?.message || "Perkhidmatan AI mengalami ralat." }, 502);
    }

    const answer = data.output_text || (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n")
      .trim();

    return json({ answer: answer || "AI tidak menghasilkan jawapan." });
  } catch (error) {
    console.error(error);
    return json({ error: error?.message || "Permintaan AI tidak dapat diproses." }, Number(error?.status) || 500);
  }
};

export const config = { path: "/.netlify/functions/ai-tutor" };
