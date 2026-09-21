"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function ReviewForm({ clubId }: { clubId: string }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    setMsg("");
    try {
      await api(`/api/v1/clubs/${clubId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating, text }),
      });
      setMsg("Отзыв сохранён.");
    } catch (e: any) {
      setMsg(e.message === "UNAUTHORIZED" ? "Войдите, чтобы оставить отзыв." : e.message);
    }
  }

  return (
    <form
      className="mt-6 border-t border-line pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="block text-sm text-dim" htmlFor="rating">
        Оценка
      </label>
      <select
        id="rating"
        className="field-hud mt-1 w-auto"
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
      >
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} из 5
          </option>
        ))}
      </select>
      <label className="mt-4 block text-sm text-dim" htmlFor="review">
        Комментарий
      </label>
      <textarea
        id="review"
        className="field-hud mt-1 min-h-24 py-3"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="btn-hud mt-3 min-h-12 text-base">
        Отзыв
      </button>
      {msg && <p className="mt-2 text-sm text-coral">{msg}</p>}
    </form>
  );
}
