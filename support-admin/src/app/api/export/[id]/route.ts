import { createSupabaseServer } from "@/shared/api/supabase-server";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const clientId = Number(id);
  if (!clientId) return new Response("Bad request", { status: 400 });

  const { data: messages } = await supabase
    .from("messages")
    .select("created_at, sender_type, text, manager_id, managers(name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  const rows: string[][] = [["Дата", "Отправитель", "Тип", "Сообщение"]];
  for (const m of messages ?? []) {
    const date = new Date(m.created_at as string).toLocaleString("ru-RU");
    const type = m.sender_type as string;
    const senderLabel =
      type === "client"
        ? "Клиент"
        : type === "bot"
          ? "Бот"
          : type === "note"
            ? "Заметка"
            : ((m.managers as { name?: string } | null)?.name ?? "Менеджер");
    rows.push([date, senderLabel, type, m.text as string]);
  }

  const csv = rows
    .map((r) =>
      r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="chat-${clientId}.csv"`,
    },
  });
}
